import "server-only"

import { Client, Pool, types as pgTypes, type PoolClient } from "pg"
import Cursor from "pg-cursor"

import type {
  Cell,
  ColumnKind,
  QueryResult,
  ResultColumn,
  SchemaInfo,
  SchemaTable,
} from "@/lib/data-types"
import type { CompiledQuery } from "@/lib/sql-params"

import {
  DataSourceError,
  type ConnectionConfig,
  type DataSourceAdapter,
  type ExecOptions,
  type ExecutionHandle,
  type ExplainResult,
} from "./types"

/** OID → (kind, native name) for the built-in types we map explicitly. */
const OID_KINDS: Record<number, [ColumnKind, string]> = {
  16: ["boolean", "bool"],
  20: ["integer", "int8"],
  21: ["integer", "int2"],
  23: ["integer", "int4"],
  26: ["integer", "oid"],
  700: ["number", "float4"],
  701: ["number", "float8"],
  790: ["decimal", "money"],
  1700: ["decimal", "numeric"],
  25: ["text", "text"],
  18: ["text", "char"],
  19: ["text", "name"],
  1042: ["text", "bpchar"],
  1043: ["text", "varchar"],
  2950: ["text", "uuid"],
  869: ["text", "inet"],
  1082: ["date", "date"],
  1114: ["datetime", "timestamp"],
  1184: ["datetime", "timestamptz"],
  1083: ["text", "time"],
  1266: ["text", "timetz"],
  1186: ["text", "interval"],
  114: ["json", "json"],
  3802: ["json", "jsonb"],
  17: ["text", "bytea"],
}

/**
 * Type parsers for user queries: dates and timestamps stay as the database
 * text (no timezone surprises), int8/numeric stay strings (precision), JSON is
 * parsed, everything else uses the pg defaults.
 */
const RAW_TEXT_OIDS = new Set([
  1082, 1114, 1184, 1083, 1266, 1186, 17, 20, 1700, 790,
])
const resultTypes = {
  getTypeParser(oid: number, format?: "text" | "binary") {
    if (RAW_TEXT_OIDS.has(oid)) return (value: string) => value
    return pgTypes.getTypeParser(oid, format)
  },
}

function kindOf(oid: number): ColumnKind {
  return OID_KINDS[oid]?.[0] ?? "unknown"
}

/** Translates PostgreSQL errors into short pt-BR messages. */
export function translatePgError(error: unknown): DataSourceError {
  if (error instanceof DataSourceError) return error
  const e = error as { code?: string; message?: string; position?: string }
  const message = e?.message ?? String(error)
  switch (e?.code) {
    case "57014":
      return message.includes("statement timeout")
        ? new DataSourceError(
            "A query excedeu o tempo limite e foi interrompida.",
            "timeout",
            message
          )
        : new DataSourceError("Execução cancelada.", "cancelled", message)
    case "25006":
      return new DataSourceError(
        "Escrita bloqueada: as queries rodam em transação somente leitura.",
        "forbidden",
        message
      )
    case "42601":
      return new DataSourceError(
        message.includes("multiple commands")
          ? "Envie um único comando por vez."
          : `Erro de sintaxe: ${message}`,
        "query",
        message
      )
    case "42P01":
      return new DataSourceError(
        `Tabela ou view inexistente: ${message}`,
        "query",
        message
      )
    case "42703":
      return new DataSourceError(
        `Coluna inexistente: ${message}`,
        "query",
        message
      )
    case "42501":
      return new DataSourceError(
        `Sem permissão no banco: ${message}`,
        "forbidden",
        message
      )
    case "55P03":
      return new DataSourceError(
        "Tempo de espera por bloqueio esgotado (lock_timeout).",
        "timeout",
        message
      )
    case "28P01":
    case "28000":
      return new DataSourceError(
        "Usuário ou senha do banco recusados.",
        "connection",
        message
      )
    case "3D000":
      return new DataSourceError(
        "Banco de dados inexistente.",
        "connection",
        message
      )
  }
  if (
    /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|timeout expired|Connection terminated/i.test(
      message
    )
  ) {
    return new DataSourceError(
      "Não foi possível conectar ao banco (endereço, porta ou rede).",
      "connection",
      message
    )
  }
  if (/SSL|self[- ]signed|certificate/i.test(message)) {
    return new DataSourceError(
      "Falha na negociação SSL com o banco. Revise a opção de SSL.",
      "connection",
      message
    )
  }
  return new DataSourceError(message, "query", message)
}

function poolConfig(config: ConnectionConfig) {
  return {
    host: config.host,
    port: config.port ?? 5432,
    database: config.database,
    user: config.username,
    password: config.password ?? undefined,
    ssl:
      config.ssl === "disable"
        ? false
        : { rejectUnauthorized: config.ssl === "verify-full" },
    connectionTimeoutMillis: 10_000,
    application_name: "sqlboard",
  }
}

function clampMs(value: number) {
  return Math.max(100, Math.min(Math.trunc(value), 15 * 60_000))
}

export class PostgresAdapter implements DataSourceAdapter {
  readonly dialect = "postgres" as const
  readonly placeholderStyle = "dollar" as const
  private pool: Pool

  constructor(private config: ConnectionConfig) {
    // Low client limit per connection and idle shutdown (PROMPT.md §4.2.6).
    this.pool = new Pool({
      ...poolConfig(config),
      max: 4,
      idleTimeoutMillis: 30_000,
    })
    this.pool.on("error", () => {
      // Idle client errors (server restart) must not crash the process.
    })
  }

  mapType(native: unknown): ColumnKind {
    return typeof native === "number" ? kindOf(native) : "unknown"
  }

  async close() {
    await this.pool.end()
  }

  async testConnection(): Promise<void> {
    let client: PoolClient | undefined
    try {
      client = await this.pool.connect()
      await client.query({ text: "SELECT 1", queryMode: "extended" } as never)
    } catch (error) {
      throw translatePgError(error)
    } finally {
      client?.release()
    }
  }

  /** Runs `fn` inside BEGIN READ ONLY with statement/lock timeouts, then ROLLBACK. */
  private async readOnly<T>(
    timeoutMs: number,
    fn: (client: PoolClient) => Promise<T>,
    onClient?: (client: PoolClient) => void
  ): Promise<T> {
    let client: PoolClient
    try {
      client = await this.pool.connect()
    } catch (error) {
      throw translatePgError(error)
    }
    let broken = false
    try {
      onClient?.(client)
      await client.query("BEGIN TRANSACTION READ ONLY")
      const ms = clampMs(timeoutMs)
      // Integers we control, never user text.
      await client.query(`SET LOCAL statement_timeout = ${ms}`)
      await client.query(`SET LOCAL lock_timeout = ${Math.min(ms, 10_000)}`)
      await client.query(
        `SET LOCAL idle_in_transaction_session_timeout = ${ms + 5_000}`
      )
      return await fn(client)
    } catch (error) {
      throw translatePgError(error)
    } finally {
      try {
        await client.query("ROLLBACK")
      } catch {
        broken = true
      }
      client.release(broken)
    }
  }

  async execute(query: CompiledQuery, opts: ExecOptions): Promise<QueryResult> {
    const started = performance.now()
    const maxRows = Math.max(1, Math.trunc(opts.maxRows))
    let pid: number | undefined
    let cancelled = false
    const handle: ExecutionHandle = {
      cancel: async () => {
        cancelled = true
        if (pid) await this.cancelBackend(pid)
      },
    }
    const onAbort = () => void handle.cancel()
    if (opts.signal?.aborted) {
      throw new DataSourceError("Execução cancelada.", "cancelled")
    }
    opts.signal?.addEventListener("abort", onAbort, { once: true })

    try {
      return await this.readOnly(
        opts.timeoutMs,
        async (client) => {
          if (cancelled)
            throw new DataSourceError("Execução cancelada.", "cancelled")
          // pg-cursor always uses the extended protocol (Parse/Bind/Execute),
          // so PostgreSQL rejects more than one statement per call.
          const cursor = client.query(
            new Cursor(query.sql, query.values as unknown[], {
              rowMode: "array",
              types: resultTypes,
            })
          )
          opts.onStart?.(handle)
          const { rows, fields } = await new Promise<{
            rows: unknown[][]
            fields: { name: string; dataTypeID: number }[]
          }>((resolve, reject) => {
            cursor.read(maxRows + 1, (error, rows, result) => {
              if (error) reject(error)
              else
                resolve({
                  rows: rows as unknown[][],
                  fields: (result?.fields ?? []) as never,
                })
            })
          })
          await cursor.close().catch(() => undefined)
          const truncated = rows.length > maxRows
          const columns: ResultColumn[] = fields.map((field) => ({
            name: field.name,
            kind: kindOf(field.dataTypeID),
            nativeType:
              OID_KINDS[field.dataTypeID]?.[1] ?? `oid:${field.dataTypeID}`,
          }))
          const kept = truncated ? rows.slice(0, maxRows) : rows
          return {
            columns,
            rows: kept.map((row) => row.map(toCell)),
            rowCount: kept.length,
            truncated,
            durationMs: Math.round(performance.now() - started),
            limit: maxRows,
          }
        },
        (client) => {
          pid = (client as unknown as { processID?: number }).processID
        }
      )
    } catch (error) {
      if (cancelled)
        throw new DataSourceError("Execução cancelada.", "cancelled")
      throw error
    } finally {
      opts.signal?.removeEventListener("abort", onAbort)
    }
  }

  async explain(
    query: CompiledQuery,
    opts: { timeoutMs: number }
  ): Promise<ExplainResult> {
    // EXPLAIN without ANALYZE: the query is planned, never executed.
    return this.readOnly(opts.timeoutMs, async (client) => {
      const result = await client.query({
        text: `EXPLAIN (FORMAT TEXT) ${query.sql}`,
        values: query.values as unknown[],
        queryMode: "extended",
      } as never)
      const plan = (
        result as unknown as { rows: Record<string, string>[] }
      ).rows
        .map((row) => row["QUERY PLAN"])
        .join("\n")
      return { plan }
    })
  }

  async cancel(handle: ExecutionHandle) {
    await handle.cancel()
  }

  /** pg_cancel_backend from a separate connection (the pool may be busy). */
  private async cancelBackend(pid: number) {
    const client = new Client(poolConfig(this.config))
    try {
      await client.connect()
      await client.query("SELECT pg_cancel_backend($1)", [pid])
    } catch {
      // Best effort: the statement timeout still bounds the query.
    } finally {
      await client.end().catch(() => undefined)
    }
  }

  async introspect(): Promise<SchemaInfo> {
    return this.readOnly(60_000, async (client) => {
      const version = await client.query<{ server_version: string }>(
        "SHOW server_version"
      )
      const excluded = `n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg\\_%'`
      const relations = await client.query<{
        schema: string
        name: string
        relkind: string
        comment: string | null
        oid: number
      }>(`
        SELECT n.nspname AS schema, c.relname AS name, c.relkind, c.oid,
               obj_description(c.oid, 'pg_class') AS comment
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f') AND ${excluded}
          AND has_schema_privilege(n.oid, 'USAGE')
        ORDER BY 1, 2`)
      const columns = await client.query<{
        relid: number
        name: string
        type: string
        typid: number
        nullable: boolean
        comment: string | null
        pk: boolean
      }>(`
        SELECT a.attrelid AS relid, a.attname AS name,
               format_type(a.atttypid, a.atttypmod) AS type, a.atttypid AS typid,
               NOT a.attnotnull AS nullable,
               col_description(a.attrelid, a.attnum) AS comment,
               EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = a.attrelid
                       AND i.indisprimary AND a.attnum = ANY(i.indkey)) AS pk
        FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE a.attnum > 0 AND NOT a.attisdropped
          AND c.relkind IN ('r', 'p', 'v', 'm', 'f') AND ${excluded}
        ORDER BY a.attrelid, a.attnum`)
      const fks = await client.query<{
        relid: number
        columns: string[]
        ref_schema: string
        ref_table: string
        ref_columns: string[]
      }>(`
        SELECT con.conrelid AS relid,
          ARRAY(SELECT attname FROM pg_attribute WHERE attrelid = con.conrelid
                AND attnum = ANY(con.conkey) ORDER BY attnum)::text[] AS columns,
          rn.nspname AS ref_schema, rc.relname AS ref_table,
          ARRAY(SELECT attname FROM pg_attribute WHERE attrelid = con.confrelid
                AND attnum = ANY(con.confkey) ORDER BY attnum)::text[] AS ref_columns
        FROM pg_constraint con
        JOIN pg_class rc ON rc.oid = con.confrelid
        JOIN pg_namespace rn ON rn.oid = rc.relnamespace
        WHERE con.contype = 'f'`)
      const indexes = await client.query<{
        relid: number
        name: string
        definition: string
      }>(`
        SELECT i.indrelid AS relid, ic.relname AS name, pg_get_indexdef(i.indexrelid) AS definition
        FROM pg_index i JOIN pg_class ic ON ic.oid = i.indexrelid
        ORDER BY ic.relname`)

      const byRel = new Map<number, SchemaTable>()
      const tables: SchemaTable[] = relations.rows.map((rel) => {
        const table: SchemaTable = {
          schema: rel.schema,
          name: rel.name,
          type: rel.relkind === "v" || rel.relkind === "m" ? "view" : "table",
          comment: rel.comment,
          columns: [],
          foreignKeys: [],
          indexes: [],
        }
        byRel.set(Number(rel.oid), table)
        return table
      })
      for (const col of columns.rows) {
        byRel.get(Number(col.relid))?.columns.push({
          name: col.name,
          type: col.type,
          kind: kindOf(Number(col.typid)),
          nullable: col.nullable,
          comment: col.comment,
          primaryKey: col.pk,
        })
      }
      for (const fk of fks.rows) {
        byRel.get(Number(fk.relid))?.foreignKeys.push({
          columns: fk.columns,
          references: {
            schema: fk.ref_schema,
            table: fk.ref_table,
            columns: fk.ref_columns,
          },
        })
      }
      for (const index of indexes.rows) {
        byRel.get(Number(index.relid))?.indexes.push({
          name: index.name,
          definition: index.definition,
        })
      }
      return {
        serverVersion:
          `PostgreSQL ${version.rows[0]?.server_version ?? ""}`.trim(),
        tables,
        introspectedAt: new Date().toISOString(),
      }
    })
  }
}

function toCell(value: unknown): Cell {
  if (value === null || value === undefined) return null
  if (typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number")
    return Number.isFinite(value) ? value : String(value)
  if (typeof value === "bigint") return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (Buffer.isBuffer(value)) return `\\x${value.toString("hex")}`
  if (Array.isArray(value)) return value.map(toCell)
  if (typeof value === "object") return value as Record<string, unknown>
  return String(value)
}
