import "server-only"

import mysql, { type FieldPacket, type Pool, type PoolConnection } from "mysql2"

import type {
  ColumnKind,
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

/** mysql2 column type code → (kind, name). */
const TYPE_KINDS: Record<number, [ColumnKind, string]> = {
  0: ["decimal", "decimal"],
  1: ["integer", "tinyint"],
  2: ["integer", "smallint"],
  3: ["integer", "int"],
  4: ["number", "float"],
  5: ["number", "double"],
  7: ["datetime", "timestamp"],
  8: ["integer", "bigint"],
  9: ["integer", "mediumint"],
  10: ["date", "date"],
  11: ["text", "time"],
  12: ["datetime", "datetime"],
  13: ["integer", "year"],
  15: ["text", "varchar"],
  16: ["integer", "bit"],
  245: ["json", "json"],
  246: ["decimal", "decimal"],
  247: ["text", "enum"],
  248: ["text", "set"],
  252: ["text", "blob/text"],
  253: ["text", "varchar"],
  254: ["text", "char"],
}

export function translateMysqlError(error: unknown): DataSourceError {
  if (error instanceof DataSourceError) return error
  const e = error as { code?: string; errno?: number; message?: string }
  const message = e?.message ?? String(error)
  switch (e?.code) {
    case "ER_QUERY_INTERRUPTED":
      return new DataSourceError("Execução cancelada.", "cancelled", message)
    case "ER_QUERY_TIMEOUT":
    case "ER_STATEMENT_TIMEOUT":
      return new DataSourceError(
        "A query excedeu o tempo limite e foi interrompida.",
        "timeout",
        message
      )
    case "ER_CANT_EXECUTE_IN_READ_ONLY_TRANSACTION":
      return new DataSourceError(
        "Escrita bloqueada: as queries rodam em transação somente leitura.",
        "forbidden",
        message
      )
    case "ER_ACCESS_DENIED_ERROR":
      return new DataSourceError(
        "Usuário ou senha do banco recusados.",
        "connection",
        message
      )
    case "ER_BAD_DB_ERROR":
      return new DataSourceError(
        "Banco de dados inexistente.",
        "connection",
        message
      )
    case "ER_NO_SUCH_TABLE":
      return new DataSourceError(
        `Tabela ou view inexistente: ${message}`,
        "query",
        message
      )
    case "ER_BAD_FIELD_ERROR":
      return new DataSourceError(
        `Coluna inexistente: ${message}`,
        "query",
        message
      )
    case "ER_TABLEACCESS_DENIED_ERROR":
    case "ER_COLUMNACCESS_DENIED_ERROR":
      return new DataSourceError(
        `Sem permissão no banco: ${message}`,
        "forbidden",
        message
      )
    case "ER_PARSE_ERROR":
      return new DataSourceError(
        `Erro de sintaxe: ${message}`,
        "query",
        message
      )
    case "ECONNREFUSED":
    case "ENOTFOUND":
    case "ETIMEDOUT":
    case "PROTOCOL_CONNECTION_LOST":
      return new DataSourceError(
        "Não foi possível conectar ao banco (endereço, porta ou rede).",
        "connection",
        message
      )
  }
  if (/max_statement_time|maximum statement execution time/i.test(message)) {
    return new DataSourceError(
      "A query excedeu o tempo limite e foi interrompida.",
      "timeout",
      message
    )
  }
  return new DataSourceError(message, "query", message)
}

/**
 * MySQL / MariaDB adapter. Real server-side prepared statements (`execute`,
 * binary protocol: one statement per call, values never interpolated),
 * read-only transaction, statement timeout, streaming read until N+1 rows and
 * cancellation with `KILL QUERY` from another connection.
 */
/** sql_mode values that change how quotes and backslashes are lexed. */
const UNSAFE_SQL_MODES = new Set([
  "ANSI_QUOTES",
  "NO_BACKSLASH_ESCAPES",
  "ANSI",
  "DB2",
  "MAXDB",
  "MSSQL",
  "ORACLE",
  "POSTGRESQL",
])

export class MysqlAdapter implements DataSourceAdapter {
  readonly dialect = "mysql" as const
  readonly placeholderStyle = "question" as const
  private pool: Pool
  private flavor: "mysql" | "mariadb" | null = null

  constructor(private config: ConnectionConfig) {
    this.pool = mysql.createPool({
      ...this.options(),
      connectionLimit: 4,
      idleTimeout: 30_000,
      maxIdle: 2,
    })
  }

  private options() {
    return {
      host: this.config.host,
      port: this.config.port ?? 3306,
      user: this.config.username,
      password: this.config.password ?? undefined,
      database: this.config.database,
      ssl:
        this.config.ssl === "disable"
          ? undefined
          : { rejectUnauthorized: this.config.ssl === "verify-full" },
      connectTimeout: 10_000,
      dateStrings: true,
      supportBigNumbers: true,
      bigNumberStrings: true,
      decimalNumbers: false,
      multipleStatements: false,
      charset: "utf8mb4",
    }
  }

  mapType(native: unknown): ColumnKind {
    return typeof native === "number"
      ? (TYPE_KINDS[native]?.[0] ?? "unknown")
      : "unknown"
  }

  async close() {
    await new Promise<void>((resolve) => this.pool.end(() => resolve()))
  }

  private connect(): Promise<PoolConnection> {
    return new Promise((resolve, reject) =>
      this.pool.getConnection((error, connection) =>
        error ? reject(translateMysqlError(error)) : resolve(connection)
      )
    )
  }

  private run(connection: PoolConnection, sql: string): Promise<unknown[]> {
    return new Promise((resolve, reject) =>
      connection.query(sql, (error, rows) =>
        error ? reject(error) : resolve(rows as unknown[])
      )
    )
  }

  /**
   * COM_RESET_CONNECTION before the pooled connection goes back: user
   * variables (@x) and GET_LOCK locks survive ROLLBACK and would leak to the
   * next user of the pool.
   */
  /**
   * The statement validator reads "..." as a string and honours backslash
   * escapes, as MySQL does by default. ANSI_QUOTES, NO_BACKSLASH_ESCAPES (or
   * a combination mode that includes them) would make the server read the
   * text differently, so they are dropped for the session.
   */
  private async enforceSqlMode(connection: PoolConnection) {
    const [row] = (await this.run(
      connection,
      "SELECT @@SESSION.sql_mode AS m"
    )) as { m?: string }[]
    const modes = String(row?.m ?? "")
      .split(",")
      .filter(Boolean)
    const safe = modes.filter((mode) => !UNSAFE_SQL_MODES.has(mode))
    if (safe.length === modes.length) return
    const value = safe.join(",")
    if (!/^[A-Z0-9_,]*$/.test(value)) {
      throw new Error("sql_mode inesperado no servidor MySQL.")
    }
    await this.run(connection, `SET SESSION sql_mode = '${value}'`)
  }

  private resetSession(connection: PoolConnection) {
    return new Promise<void>((resolve, reject) =>
      connection.reset((error) => (error ? reject(error) : resolve()))
    )
  }

  async testConnection() {
    const connection = await this.connect()
    try {
      await this.run(connection, "SELECT 1")
    } catch (error) {
      throw translateMysqlError(error)
    } finally {
      connection.release()
    }
  }

  private async detectFlavor(connection: PoolConnection) {
    if (!this.flavor) {
      const [row] = (await this.run(connection, "SELECT VERSION() AS v")) as {
        v: string
      }[]
      this.flavor = /mariadb/i.test(row?.v ?? "") ? "mariadb" : "mysql"
    }
    return this.flavor
  }

  /** Read-only transaction with a statement timeout; always rolled back. */
  private async readOnly<T>(
    timeoutMs: number,
    fn: (connection: PoolConnection) => Promise<T>,
    onConnection?: (c: PoolConnection) => void
  ) {
    const connection = await this.connect()
    let broken = false
    try {
      onConnection?.(connection)
      const flavor = await this.detectFlavor(connection)
      await this.enforceSqlMode(connection)
      const ms = clampMs(timeoutMs)
      // Integers we control, never user text. The server limit is a
      // backstop one second after the client timer: MySQL ends an
      // interrupted SLEEP() silently, so the client timer (which flags the
      // run as timed out) must fire first.
      const backstop = ms + 1000
      await this.run(
        connection,
        flavor === "mariadb"
          ? `SET SESSION max_statement_time = ${backstop / 1000}`
          : `SET SESSION max_execution_time = ${backstop}`
      )
      await this.run(
        connection,
        `SET SESSION innodb_lock_wait_timeout = ${Math.max(1, Math.round(Math.min(ms, 10_000) / 1000))}`
      )
      await this.run(connection, "START TRANSACTION READ ONLY")
      return await fn(connection)
    } catch (error) {
      broken = (error as { fatal?: boolean })?.fatal === true
      throw translateMysqlError(error)
    } finally {
      if (!broken) {
        try {
          await this.run(connection, "ROLLBACK")
          await this.resetSession(connection)
        } catch {
          broken = true
        }
      }
      if (broken) connection.destroy()
      else connection.release()
    }
  }

  async execute(query: CompiledQuery, opts: ExecOptions): Promise<QueryResult> {
    const started = performance.now()
    const maxRows = Math.max(1, Math.trunc(opts.maxRows))
    let threadId: number | null = null
    let cancelled = false
    let timedOut = false
    // A KILL QUERY still in flight when the connection goes back to the pool
    // would interrupt the next user's query: every kill is awaited before
    // the connection is released.
    let pendingKill: Promise<void> | null = null
    const killQuery = (id: number) =>
      (pendingKill ??= this.kill(id).catch(() => undefined))
    const handle: ExecutionHandle = {
      cancel: async () => {
        cancelled = true
        if (threadId !== null) await killQuery(threadId)
      },
    }
    if (opts.signal?.aborted)
      throw new DataSourceError("Execução cancelada.", "cancelled")
    const onAbort = () => void handle.cancel()
    opts.signal?.addEventListener("abort", onAbort, { once: true })
    try {
      return await this.readOnly(
        opts.timeoutMs,
        (connection) =>
          new Promise<QueryResult>((resolve, reject) => {
            const rows: unknown[][] = []
            let fields: FieldPacket[] = []
            let finished = false
            const finish = (fn: () => void) => {
              if (finished) return
              finished = true
              fn()
            }
            const command = connection.execute({
              sql: query.sql,
              values: query.values as never,
              rowsAsArray: true,
            })
            opts.onStart?.(handle)
            command.on("fields", (f: FieldPacket[]) => {
              fields = f
            })
            command.on("result", (row: unknown) => {
              if (finished) return
              rows.push(row as unknown[])
              if (rows.length > maxRows) {
                // Stop reading: kill the statement, keep what we have.
                finish(() => {
                  clearTimeout(timer)
                  void killQuery(connection.threadId)
                  resolve(this.result(fields, rows, maxRows, started))
                })
              }
            })
            // MySQL ends an interrupted SLEEP() without an error, and
            // max_execution_time only covers SELECT: a client timer kills the
            // statement too, and an interrupted run never counts as success.
            const timer = setTimeout(() => {
              timedOut = true
              void killQuery(connection.threadId)
            }, clampMs(opts.timeoutMs))
            const interrupted = () =>
              cancelled
                ? new DataSourceError("Execução cancelada.", "cancelled")
                : timedOut
                  ? new DataSourceError(
                      "A query excedeu o tempo limite e foi interrompida.",
                      "timeout"
                    )
                  : null
            command.on("error", (error: Error) =>
              finish(() => {
                clearTimeout(timer)
                reject(interrupted() ?? error)
              })
            )
            command.on("end", () =>
              finish(() => {
                clearTimeout(timer)
                const error = interrupted()
                if (error) reject(error)
                else resolve(this.result(fields, rows, maxRows, started))
              })
            )
          }).finally(() => pendingKill),
        (connection) => {
          threadId = connection.threadId
        }
      )
    } catch (error) {
      if (cancelled)
        throw new DataSourceError("Execução cancelada.", "cancelled")
      throw translateMysqlError(error)
    } finally {
      opts.signal?.removeEventListener("abort", onAbort)
    }
  }

  private result(
    fields: FieldPacket[],
    rows: unknown[][],
    maxRows: number,
    started: number
  ): QueryResult {
    const truncated = rows.length > maxRows
    const kept = truncated ? rows.slice(0, maxRows) : rows
    const columns: ResultColumn[] = fields.map((f) => {
      const type =
        (f as { columnType?: number; type?: number }).columnType ??
        (f as { type?: number }).type ??
        -1
      return {
        name: f.name,
        kind: TYPE_KINDS[type]?.[0] ?? "unknown",
        nativeType: TYPE_KINDS[type]?.[1] ?? `type:${type}`,
      }
    })
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
   * Write action: one prepared statement in its own transaction, with lock
   * wait limit and a client timer (KILL QUERY); rolled back on preview or
   * when more rows than allowed were affected.
   */
  async executeWrite(
    query: CompiledQuery,
    opts: WriteOptions
  ): Promise<WriteResult> {
    const started = performance.now()
    const connection = await this.connect()
    const ms = clampMs(opts.timeoutMs)
    let committed = false
    let broken = false
    let timedOut = false
    let killing: Promise<void> | null = null
    const timer = setTimeout(() => {
      timedOut = true
      killing = this.kill(connection.threadId).catch(() => undefined)
    }, ms)
    try {
      await this.enforceSqlMode(connection)
      // Integer we control, never user text.
      await this.run(
        connection,
        `SET SESSION innodb_lock_wait_timeout = ${Math.max(1, Math.round(Math.min(ms, 10_000) / 1000))}`
      )
      await this.run(connection, "START TRANSACTION READ WRITE")
      const header = await new Promise<{ affectedRows: number }>(
        (resolve, reject) =>
          connection.execute(
            query.sql,
            query.values as never,
            (error, result) =>
              error
                ? reject(error)
                : resolve(result as { affectedRows: number })
          )
      )
      if (timedOut) {
        throw new DataSourceError(
          "O comando excedeu o tempo limite e foi interrompido.",
          "timeout"
        )
      }
      const affectedRows = header.affectedRows ?? 0
      if (affectedRows > opts.maxAffectedRows) {
        throw tooManyRows(affectedRows, opts.maxAffectedRows)
      }
      if (opts.commit) {
        await this.run(connection, "COMMIT")
        committed = true
      }
      return {
        affectedRows,
        committed,
        durationMs: Math.round(performance.now() - started),
      }
    } catch (error) {
      broken = (error as { fatal?: boolean })?.fatal === true
      if (timedOut && !(error instanceof DataSourceError)) {
        throw new DataSourceError(
          "O comando excedeu o tempo limite e foi interrompido.",
          "timeout"
        )
      }
      throw translateMysqlError(error)
    } finally {
      clearTimeout(timer)
      // Never hand the connection back with a KILL still on its way.
      await killing
      if (!broken) {
        try {
          if (!committed) await this.run(connection, "ROLLBACK")
          await this.resetSession(connection)
        } catch {
          broken = true
        }
      }
      if (broken) connection.destroy()
      else connection.release()
    }
  }

  /** KILL QUERY from a separate connection (best effort). */
  private async kill(threadId: number) {
    const connection = mysql.createConnection(this.options())
    try {
      await new Promise<void>((resolve) =>
        connection.query(`KILL QUERY ${Number(threadId)}`, () => resolve())
      )
    } finally {
      connection.destroy()
    }
  }

  async cancel(handle: ExecutionHandle) {
    await handle.cancel()
  }

  async explain(
    query: CompiledQuery,
    opts: { timeoutMs: number }
  ): Promise<ExplainResult> {
    return this.readOnly(
      opts.timeoutMs,
      (connection) =>
        new Promise((resolve, reject) =>
          connection.execute(
            { sql: `EXPLAIN ${query.sql}`, values: query.values as never },
            (error, rows) => {
              if (error) return reject(error)
              resolve({
                plan: (rows as Record<string, unknown>[])
                  .map((row) => JSON.stringify(row))
                  .join("\n"),
              })
            }
          )
        )
    )
  }

  async introspect(): Promise<SchemaInfo> {
    return this.readOnly(60_000, async (connection) => {
      const [version] = (await this.run(
        connection,
        "SELECT VERSION() AS v"
      )) as { v: string }[]
      const tables = (await this.run(
        connection,
        `SELECT TABLE_SCHEMA AS s, TABLE_NAME AS n, TABLE_TYPE AS t, TABLE_COMMENT AS c
           FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME`
      )) as { s: string; n: string; t: string; c: string }[]
      const columns = (await this.run(
        connection,
        `SELECT TABLE_NAME AS tn, COLUMN_NAME AS n, COLUMN_TYPE AS ct, DATA_TYPE AS dt, IS_NULLABLE AS nl,
                COLUMN_COMMENT AS c, COLUMN_KEY AS k
           FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
          ORDER BY TABLE_NAME, ORDINAL_POSITION`
      )) as {
        tn: string
        n: string
        ct: string
        dt: string
        nl: string
        c: string
        k: string
      }[]
      const fks = (await this.run(
        connection,
        `SELECT TABLE_NAME AS tn, CONSTRAINT_NAME AS cn, COLUMN_NAME AS col,
                REFERENCED_TABLE_SCHEMA AS rs, REFERENCED_TABLE_NAME AS rt, REFERENCED_COLUMN_NAME AS rc
           FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
          ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION`
      )) as {
        tn: string
        cn: string
        col: string
        rs: string
        rt: string
        rc: string
      }[]
      const indexes = (await this.run(
        connection,
        `SELECT TABLE_NAME AS tn, INDEX_NAME AS n, NON_UNIQUE AS nu, COLUMN_NAME AS col
           FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()
          ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`
      )) as { tn: string; n: string; nu: number; col: string }[]

      const byName = new Map<string, SchemaTable>()
      const result = tables.map((t) => {
        const table: SchemaTable = {
          schema: t.s,
          name: t.n,
          type: t.t === "VIEW" ? "view" : "table",
          comment: t.c || null,
          columns: [],
          foreignKeys: [],
          indexes: [],
        }
        byName.set(t.n, table)
        return table
      })
      for (const c of columns) {
        byName.get(c.tn)?.columns.push({
          name: c.n,
          type: c.ct,
          kind: kindFromTypeName(c.dt),
          nullable: c.nl === "YES",
          comment: c.c || null,
          primaryKey: c.k === "PRI",
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
        const key = `${fk.tn}.${fk.cn}`
        const group = fkGroups.get(key) ?? {
          table: fk.tn,
          columns: [],
          ref: { schema: fk.rs, table: fk.rt, columns: [] },
        }
        group.columns.push(fk.col)
        group.ref.columns.push(fk.rc)
        fkGroups.set(key, group)
      }
      for (const group of fkGroups.values()) {
        byName
          .get(group.table)
          ?.foreignKeys.push({ columns: group.columns, references: group.ref })
      }
      const indexGroups = new Map<
        string,
        { table: string; name: string; unique: boolean; columns: string[] }
      >()
      for (const index of indexes) {
        const key = `${index.tn}.${index.n}`
        const group = indexGroups.get(key) ?? {
          table: index.tn,
          name: index.n,
          unique: Number(index.nu) === 0,
          columns: [],
        }
        group.columns.push(index.col)
        indexGroups.set(key, group)
      }
      for (const index of indexGroups.values()) {
        byName.get(index.table)?.indexes.push({
          name: index.name,
          definition: `${index.unique ? "UNIQUE " : ""}INDEX ${index.name} ON ${index.table} (${index.columns.join(", ")})`,
        })
      }
      return {
        serverVersion: /mariadb/i.test(version?.v ?? "")
          ? `MariaDB ${version?.v}`
          : `MySQL ${version?.v ?? ""}`,
        tables: result,
        introspectedAt: new Date().toISOString(),
      }
    })
  }
}
