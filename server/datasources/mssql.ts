import "server-only"

import sql from "mssql"

import type {
  QueryResult,
  ResultColumn,
  SchemaInfo,
  SchemaTable,
} from "@/lib/data-types"
import type { CompiledQuery } from "@/lib/sql-params"

import { clampMs, kindFromTypeName, toCell } from "./common"
import {
  DataSourceError,
  type ConnectionConfig,
  type DataSourceAdapter,
  type ExecOptions,
  type ExecutionHandle,
  type ExplainResult,
  type WriteOptions,
  type WriteResult,
  tooManyRows,
} from "./types"

export function translateMssqlError(
  error: unknown,
  timedOut = false
): DataSourceError {
  if (error instanceof DataSourceError) return error
  const e = error as {
    code?: string
    number?: number
    message?: string
    originalError?: { message?: string }
  }
  const message = e?.message ?? String(error)
  if (timedOut)
    return new DataSourceError(
      "A query excedeu o tempo limite e foi interrompida.",
      "timeout",
      message
    )
  if (e?.code === "ECANCEL")
    return new DataSourceError("Execução cancelada.", "cancelled", message)
  if (e?.code === "ETIMEOUT")
    return new DataSourceError(
      "A query excedeu o tempo limite e foi interrompida.",
      "timeout",
      message
    )
  if (e?.code === "ELOGIN" || e?.number === 18456)
    return new DataSourceError(
      "Usuário ou senha do banco recusados.",
      "connection",
      message
    )
  if (e?.code === "ESOCKET" || e?.code === "EINSTLOOKUP") {
    return new DataSourceError(
      "Não foi possível conectar ao banco (endereço, porta ou rede).",
      "connection",
      message
    )
  }
  switch (e?.number) {
    case 208:
      return new DataSourceError(
        `Tabela ou view inexistente: ${message}`,
        "query",
        message
      )
    case 207:
      return new DataSourceError(
        `Coluna inexistente: ${message}`,
        "query",
        message
      )
    case 229:
    case 230:
      return new DataSourceError(
        `Sem permissão no banco: ${message}`,
        "forbidden",
        message
      )
    case 1222:
      return new DataSourceError(
        "Tempo de espera por bloqueio esgotado (LOCK_TIMEOUT).",
        "timeout",
        message
      )
    case 102:
    case 156:
      return new DataSourceError(
        `Erro de sintaxe: ${message}`,
        "query",
        message
      )
  }
  return new DataSourceError(message, "query", message)
}

/**
 * SQL Server adapter. Each execution runs inside a transaction that is always
 * rolled back (SQL Server has no read-only transaction), with LOCK_TIMEOUT,
 * a client-side statement timeout, streaming until N+1 rows and cancellation
 * through the TDS attention signal (`request.cancel()`). Values go as typed
 * parameters (@p1…) through sp_executesql. See the README for limitations.
 */
export class MssqlAdapter implements DataSourceAdapter {
  readonly dialect = "mssql" as const
  readonly placeholderStyle = "at" as const
  private pool: sql.ConnectionPool
  private connecting: Promise<sql.ConnectionPool> | null = null

  constructor(private config: ConnectionConfig) {
    this.pool = new sql.ConnectionPool({
      server: config.host,
      port: config.port ?? 1433,
      database: config.database,
      user: config.username,
      password: config.password ?? undefined,
      connectionTimeout: 10_000,
      requestTimeout: 15 * 60_000,
      pool: { max: 4, min: 0, idleTimeoutMillis: 30_000 },
      options: {
        encrypt: config.ssl !== "disable",
        trustServerCertificate: config.ssl !== "verify-full",
        appName: "sqlboard",
      },
    })
    this.pool.on("error", () => {
      // Idle connection errors must not crash the process.
    })
  }

  private async connected() {
    if (this.pool.connected) return this.pool
    this.connecting ??= this.pool.connect().finally(() => {
      this.connecting = null
    })
    try {
      return await this.connecting
    } catch (error) {
      throw translateMssqlError(error)
    }
  }

  mapType(native: unknown) {
    return kindFromTypeName(typeof native === "string" ? native : "")
  }

  async close() {
    await this.pool.close().catch(() => undefined)
  }

  async testConnection() {
    const pool = await this.connected()
    try {
      await pool.request().query("SELECT 1 AS ok")
    } catch (error) {
      throw translateMssqlError(error)
    }
  }

  /** Transaction that is always rolled back, with LOCK_TIMEOUT. */
  private async rolledBack<T>(
    timeoutMs: number,
    fn: (tx: sql.Transaction) => Promise<T>
  ): Promise<T> {
    const pool = await this.connected()
    const tx = new sql.Transaction(pool)
    await tx.begin()
    try {
      // Integer we control, never user text.
      await new sql.Request(tx).batch(
        `SET LOCK_TIMEOUT ${Math.min(clampMs(timeoutMs), 10_000)}`
      )
      const result = await fn(tx)
      // Defense in depth: a batch that ended our transaction (COMMIT) may
      // have persisted changes; never report it as a normal result.
      const check = await new sql.Request(tx).query<{ n: number }>(
        "SELECT @@TRANCOUNT AS n"
      )
      if ((check.recordset[0]?.n ?? 0) < 1) {
        console.error("[mssql] transação encerrada pela query do usuário")
        throw new DataSourceError(
          "A query encerrou a transação de leitura. Use um login só com leitura (db_datareader).",
          "forbidden"
        )
      }
      return result
    } finally {
      await tx.rollback().catch(() => undefined)
    }
  }

  async execute(query: CompiledQuery, opts: ExecOptions): Promise<QueryResult> {
    const started = performance.now()
    const maxRows = Math.max(1, Math.trunc(opts.maxRows))
    if (opts.signal?.aborted)
      throw new DataSourceError("Execução cancelada.", "cancelled")
    let timedOut = false
    let cancelled = false
    try {
      return await this.rolledBack(
        opts.timeoutMs,
        (tx) =>
          new Promise<QueryResult>((resolve, reject) => {
            const request = new sql.Request(tx)
            request.stream = true
            request.arrayRowMode = true
            query.values.forEach((value, i) =>
              request.input(`p${i + 1}`, value as never)
            )
            let columns: ResultColumn[] = []
            const rows: unknown[][] = []
            // Settle only on "done" (always emitted in stream mode, also after
            // "error"): rolling back while the request is still active fails
            // with EREQINPROG and would leak the pooled connection.
            let truncated = false
            let failure: unknown = null
            let finished = false
            const handle: ExecutionHandle = {
              cancel: async () => {
                cancelled = true
                request.cancel()
              },
            }
            const onAbort = () => void handle.cancel()
            opts.signal?.addEventListener("abort", onAbort, { once: true })
            const timer = setTimeout(() => {
              timedOut = true
              request.cancel()
            }, clampMs(opts.timeoutMs))
            request.on(
              "recordset",
              (
                meta:
                  | { name: string; type: { declaration?: string } }[]
                  | Record<
                      string,
                      { name: string; type: { declaration?: string } }
                    >
              ) => {
                const list = Array.isArray(meta) ? meta : Object.values(meta)
                columns = list.map((c) => ({
                  name: c.name,
                  kind: kindFromTypeName(c.type?.declaration),
                  nativeType: c.type?.declaration ?? "",
                }))
              }
            )
            request.on("row", (row: unknown[]) => {
              if (truncated) return
              rows.push(row)
              if (rows.length > maxRows) {
                // N+1 rows: stop the statement, keep what we have.
                truncated = true
                request.cancel()
              }
            })
            request.on("error", (error: unknown) => {
              failure ??= error
            })
            request.on("done", () => {
              if (finished) return
              finished = true
              clearTimeout(timer)
              opts.signal?.removeEventListener("abort", onAbort)
              if (truncated) {
                resolve(this.result(columns, rows, maxRows, started))
              } else if (cancelled && !timedOut) {
                reject(new DataSourceError("Execução cancelada.", "cancelled"))
              } else if (failure || timedOut) {
                reject(translateMssqlError(failure, timedOut))
              } else {
                resolve(this.result(columns, rows, maxRows, started))
              }
            })
            opts.onStart?.(handle)
            void request.query(query.sql)
          })
      )
    } catch (error) {
      throw translateMssqlError(error, timedOut)
    }
  }

  private result(
    columns: ResultColumn[],
    rows: unknown[][],
    maxRows: number,
    started: number
  ): QueryResult {
    const truncated = rows.length > maxRows
    const kept = truncated ? rows.slice(0, maxRows) : rows
    return {
      columns,
      rows: kept.map((row) => row.map(toCell)),
      rowCount: kept.length,
      truncated,
      durationMs: Math.round(performance.now() - started),
      limit: maxRows,
    }
  }

  /**
   * Write action: one parameterized statement in its own transaction, with
   * LOCK_TIMEOUT and a client timer; committed only after the request has
   * finished (rollback with an active request would leak the connection).
   */
  async executeWrite(
    query: CompiledQuery,
    opts: WriteOptions
  ): Promise<WriteResult> {
    const started = performance.now()
    const pool = await this.connected()
    const tx = new sql.Transaction(pool)
    const ms = clampMs(opts.timeoutMs)
    let committed = false
    let timedOut = false
    try {
      await tx.begin()
      await new sql.Request(tx).batch(
        `SET LOCK_TIMEOUT ${Math.min(ms, 10_000)}`
      )
      const request = new sql.Request(tx)
      query.values.forEach((value, i) =>
        request.input(`p${i + 1}`, value as never)
      )
      const timer = setTimeout(() => {
        timedOut = true
        request.cancel()
      }, ms)
      let result: sql.IResult<unknown>
      try {
        result = await request.query(query.sql)
      } finally {
        clearTimeout(timer)
      }
      const affectedRows = (result.rowsAffected ?? []).reduce(
        (sum, n) => sum + n,
        0
      )
      if (affectedRows > opts.maxAffectedRows) {
        throw tooManyRows(affectedRows, opts.maxAffectedRows)
      }
      if (opts.commit) {
        await tx.commit()
        committed = true
      }
      return {
        affectedRows,
        committed,
        durationMs: Math.round(performance.now() - started),
      }
    } catch (error) {
      throw translateMssqlError(error, timedOut)
    } finally {
      if (!committed) await tx.rollback().catch(() => undefined)
    }
  }

  async cancel(handle: ExecutionHandle) {
    await handle.cancel()
  }

  async explain(): Promise<ExplainResult> {
    throw new DataSourceError(
      "O plano de execução não está disponível para SQL Server no sqlboard.",
      "query"
    )
  }

  async introspect(): Promise<SchemaInfo> {
    return this.rolledBack(60_000, async (tx) => {
      const q = async <T>(text: string) =>
        (await new sql.Request(tx).query<T>(text)).recordset
      const [version] = await q<{ v: string }>(
        "SELECT CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(64)) AS v"
      )
      const tables = await q<{
        s: string
        n: string
        t: string
        c: string | null
      }>(`
        SELECT t.TABLE_SCHEMA AS s, t.TABLE_NAME AS n, t.TABLE_TYPE AS t,
               CAST(ep.value AS nvarchar(4000)) AS c
          FROM INFORMATION_SCHEMA.TABLES t
          LEFT JOIN sys.extended_properties ep
            ON ep.major_id = OBJECT_ID(QUOTENAME(t.TABLE_SCHEMA) + '.' + QUOTENAME(t.TABLE_NAME))
           AND ep.minor_id = 0 AND ep.name = 'MS_Description'
         ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME`)
      const columns = await q<{
        s: string
        tn: string
        n: string
        dt: string
        nl: string
        pk: number
      }>(`
        SELECT c.TABLE_SCHEMA AS s, c.TABLE_NAME AS tn, c.COLUMN_NAME AS n, c.DATA_TYPE AS dt, c.IS_NULLABLE AS nl,
               CASE WHEN EXISTS (
                 SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                 JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE k ON k.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
                  AND k.TABLE_SCHEMA = tc.TABLE_SCHEMA
                 WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY' AND k.TABLE_SCHEMA = c.TABLE_SCHEMA
                   AND k.TABLE_NAME = c.TABLE_NAME AND k.COLUMN_NAME = c.COLUMN_NAME) THEN 1 ELSE 0 END AS pk
          FROM INFORMATION_SCHEMA.COLUMNS c
         ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION`)
      const fks = await q<{
        s: string
        tn: string
        fk: string
        col: string
        rs: string
        rt: string
        rc: string
      }>(`
        SELECT SCHEMA_NAME(t.schema_id) AS s, t.name AS tn, f.name AS fk, pc.name AS col,
               SCHEMA_NAME(rt.schema_id) AS rs, rt.name AS rt, rc.name AS rc
          FROM sys.foreign_keys f
          JOIN sys.foreign_key_columns fc ON fc.constraint_object_id = f.object_id
          JOIN sys.tables t ON t.object_id = f.parent_object_id
          JOIN sys.columns pc ON pc.object_id = fc.parent_object_id AND pc.column_id = fc.parent_column_id
          JOIN sys.tables rt ON rt.object_id = f.referenced_object_id
          JOIN sys.columns rc ON rc.object_id = fc.referenced_object_id AND rc.column_id = fc.referenced_column_id
         ORDER BY f.name, fc.constraint_column_id`)
      const indexes = await q<{
        s: string
        tn: string
        n: string
        u: boolean
        col: string
      }>(`
        SELECT SCHEMA_NAME(t.schema_id) AS s, t.name AS tn, i.name AS n, i.is_unique AS u, c.name AS col
          FROM sys.indexes i
          JOIN sys.tables t ON t.object_id = i.object_id
          JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
          JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
         WHERE i.name IS NOT NULL
         ORDER BY t.name, i.name, ic.key_ordinal`)

      const key = (s: string, n: string) => `${s}.${n}`
      const byName = new Map<string, SchemaTable>()
      const result = tables.map((t) => {
        const table: SchemaTable = {
          schema: t.s,
          name: t.n,
          type: t.t === "VIEW" ? "view" : "table",
          comment: t.c,
          columns: [],
          foreignKeys: [],
          indexes: [],
        }
        byName.set(key(t.s, t.n), table)
        return table
      })
      for (const c of columns) {
        byName.get(key(c.s, c.tn))?.columns.push({
          name: c.n,
          type: c.dt,
          kind: kindFromTypeName(c.dt),
          nullable: c.nl === "YES",
          comment: null,
          primaryKey: c.pk === 1,
        })
      }
      const fkGroups = new Map<
        string,
        {
          table: string
          columns: string[]
          ref: { schema: string; table: string; columns: string[] }
        }
      >()
      for (const fk of fks) {
        const group = fkGroups.get(fk.fk) ?? {
          table: key(fk.s, fk.tn),
          columns: [],
          ref: { schema: fk.rs, table: fk.rt, columns: [] },
        }
        group.columns.push(fk.col)
        group.ref.columns.push(fk.rc)
        fkGroups.set(fk.fk, group)
      }
      for (const group of fkGroups.values())
        byName
          .get(group.table)
          ?.foreignKeys.push({ columns: group.columns, references: group.ref })
      const indexGroups = new Map<
        string,
        { table: string; name: string; unique: boolean; columns: string[] }
      >()
      for (const index of indexes) {
        const k = `${index.s}.${index.tn}.${index.n}`
        const group = indexGroups.get(k) ?? {
          table: key(index.s, index.tn),
          name: index.n,
          unique: Boolean(index.u),
          columns: [],
        }
        group.columns.push(index.col)
        indexGroups.set(k, group)
      }
      for (const index of indexGroups.values()) {
        byName.get(index.table)?.indexes.push({
          name: index.name,
          definition: `${index.unique ? "UNIQUE " : ""}INDEX ${index.name} (${index.columns.join(", ")})`,
        })
      }
      return {
        serverVersion: `SQL Server ${version?.v ?? ""}`,
        tables: result,
        introspectedAt: new Date().toISOString(),
      }
    })
  }
}
