import "server-only"
// Static import so the bundler keeps the package external and the
// standalone output traces it; the worker loads it again by name.
// (require.resolve here would become a bundler module id, not a path.)
import "better-sqlite3"

import { existsSync, realpathSync } from "node:fs"
import path from "node:path"
import { Worker } from "node:worker_threads"

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

/**
 * Worker body. better-sqlite3 is synchronous, so each operation runs in its
 * own worker thread: the main thread can enforce the timeout and cancel by
 * terminating the worker without blocking the server. The database is opened
 * read-only with `query_only`, and `prepare()` rejects multiple statements.
 */
const WORKER_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads")
// Resolved here, outside the bundle: from the working directory, or the
// hashed external that the standalone build keeps in .next/node_modules.
function loadDriver() {
  try {
    return require(require.resolve("better-sqlite3", { paths: [process.cwd()] }))
  } catch {
    const fs = require("node:fs")
    const path = require("node:path")
    const dir = path.join(process.cwd(), ".next", "node_modules")
    const entry = fs.readdirSync(dir).find((n) => n.startsWith("better-sqlite3-"))
    return require(path.join(dir, entry))
  }
}
const Database = loadDriver()
let db
try {
  const op = workerData.op
  const writing = op === "write"
  db = new Database(workerData.file, { readonly: !writing, fileMustExist: true })
  if (!writing) db.pragma("query_only = ON")
  db.defaultSafeIntegers(true)
  if (writing) {
    // One statement in an explicit transaction; closing the database without
    // COMMIT (timeout: the worker is terminated) discards the changes.
    const stmt = db.prepare(workerData.sql)
    if (stmt.reader) throw Object.assign(new Error("A ação precisa ser um INSERT ou UPDATE."), { code: "SQLBOARD_NOT_WRITER" })
    db.exec("BEGIN IMMEDIATE")
    const info = stmt.run(...workerData.values)
    const affectedRows = Number(info.changes)
    if (affectedRows > workerData.maxAffectedRows || !workerData.commit) db.exec("ROLLBACK")
    else db.exec("COMMIT")
    parentPort.postMessage({ ok: true, affectedRows, committed: affectedRows <= workerData.maxAffectedRows && workerData.commit })
  } else if (op === "test") {
    db.prepare("select 1").get()
    parentPort.postMessage({ ok: true })
  } else if (op === "execute" || op === "explain") {
    const sql = op === "explain" ? "EXPLAIN QUERY PLAN " + workerData.sql : workerData.sql
    const stmt = db.prepare(sql)
    if (!stmt.reader) throw Object.assign(new Error("A query não retorna linhas (somente leitura)."), { code: "SQLBOARD_NOT_READER" })
    const columns = stmt.columns().map((c) => ({ name: c.name, type: c.type }))
    stmt.raw(true)
    const rows = []
    for (const row of stmt.iterate(...workerData.values)) {
      rows.push(row.map((v) => (typeof v === "bigint" ? (Number.isSafeInteger(Number(v)) ? Number(v) : v.toString()) : v)))
      if (rows.length > workerData.maxRows) break
    }
    parentPort.postMessage({ ok: true, columns, rows })
  } else if (op === "introspect") {
    const version = db.prepare("select sqlite_version() as v").get().v
    const objects = db.prepare("select name, type from sqlite_master where type in ('table','view') and name not like 'sqlite_%' order by name").all()
    const tables = objects.map((o) => {
      const cols = db.prepare("select * from pragma_table_info(?)").all(o.name)
      const fks = db.prepare("select * from pragma_foreign_key_list(?)").all(o.name)
      const idx = db.prepare("select name from pragma_index_list(?)").all(o.name)
      return {
        name: o.name,
        type: o.type,
        columns: cols.map((c) => ({ name: c.name, type: c.type, notnull: Number(c.notnull), pk: Number(c.pk) })),
        fks: fks.map((f) => ({ id: Number(f.id), from: f.from, table: f.table, to: f.to })),
        indexes: idx.map((i) => {
          const sql = db.prepare("select sql from sqlite_master where type = 'index' and name = ?").get(i.name)
          return { name: i.name, sql: sql && sql.sql ? sql.sql : "INDEX " + i.name }
        }),
      }
    })
    parentPort.postMessage({ ok: true, version, tables })
  }
} catch (error) {
  parentPort.postMessage({ ok: false, message: String(error && error.message || error), code: error && error.code })
} finally {
  if (db) db.close()
}
`

type WorkerReply = {
  ok: boolean
  affectedRows?: number
  committed?: boolean
  message?: string
  code?: string
  columns?: { name: string; type: string | null }[]
  rows?: unknown[][]
  version?: string
  tables?: {
    name: string
    type: string
    columns: { name: string; type: string; notnull: number; pk: number }[]
    fks: { id: number; from: string; table: string; to: string }[]
    indexes: { name: string; sql: string }[]
  }[]
}

export function translateSqliteError(reply: {
  message?: string
  code?: string
}): DataSourceError {
  const message = reply.message ?? "Erro no SQLite."
  if (
    reply.code === "SQLITE_CANTOPEN" ||
    /unable to open|does not exist/i.test(message)
  ) {
    return new DataSourceError(
      "Arquivo do banco SQLite não encontrado ou sem permissão de leitura.",
      "connection",
      message
    )
  }
  if (reply.code === "SQLBOARD_NOT_WRITER") {
    return new DataSourceError(message, "query", message)
  }
  if (/more than one statement/i.test(message)) {
    return new DataSourceError(
      "Envie um único comando por vez.",
      "query",
      message
    )
  }
  if (
    reply.code === "SQLITE_READONLY" ||
    /readonly|query_only|attempt to write/i.test(message) ||
    reply.code === "SQLBOARD_NOT_READER"
  ) {
    return new DataSourceError(
      "Escrita bloqueada: o SQLite é aberto somente para leitura.",
      "forbidden",
      message
    )
  }
  if (/no such table/i.test(message))
    return new DataSourceError(
      `Tabela ou view inexistente: ${message}`,
      "query",
      message
    )
  if (/no such column/i.test(message))
    return new DataSourceError(
      `Coluna inexistente: ${message}`,
      "query",
      message
    )
  if (/syntax error/i.test(message))
    return new DataSourceError(`Erro de sintaxe: ${message}`, "query", message)
  return new DataSourceError(message, "query", message)
}

/**
 * SQLite files must live under SQLBOARD_SQLITE_DIR (default: ./data/sqlite),
 * so a connection cannot open arbitrary files of the server.
 */
export function resolveSqlitePath(
  file: string,
  baseDir = process.env.SQLBOARD_SQLITE_DIR ?? "data/sqlite"
) {
  const outside = (base: string) =>
    new DataSourceError(
      `O arquivo SQLite precisa ficar dentro de ${base} (variável SQLBOARD_SQLITE_DIR).`,
      "connection"
    )
  const inside = (base: string, target: string) =>
    target === base || target.startsWith(base + path.sep)
  // Runtime-configured directory: not a build input (keeps tracing scoped).
  const base = path.resolve(/* turbopackIgnore: true */ baseDir)
  const resolved = path.resolve(/* turbopackIgnore: true */ base, file)
  if (!inside(base, resolved)) throw outside(base)
  // A symlink inside the directory must not lead outside of it.
  if (existsSync(resolved)) {
    const realBase = realpathSync(base)
    if (!inside(realBase, realpathSync(resolved))) throw outside(base)
  }
  return resolved
}

export class SqliteAdapter implements DataSourceAdapter {
  readonly dialect = "sqlite" as const
  readonly placeholderStyle = "question" as const

  constructor(private config: ConnectionConfig) {}

  mapType(native: unknown) {
    return kindFromTypeName(typeof native === "string" ? native : "")
  }

  async close() {}

  /** Runs one operation in a fresh worker, terminated on timeout/cancel. */
  private runWorker(
    data: Record<string, unknown>,
    timeoutMs: number,
    signal?: AbortSignal,
    onStart?: (handle: ExecutionHandle) => void
  ): Promise<WorkerReply> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(WORKER_SOURCE, {
        eval: true,
        workerData: {
          file: resolveSqlitePath(this.config.database),
          ...data,
        },
      })
      let settled = false
      const settle = (fn: () => void) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        signal?.removeEventListener("abort", onAbort)
        fn()
        void worker.terminate()
      }
      const timer = setTimeout(
        () =>
          settle(() =>
            reject(
              new DataSourceError(
                "A query excedeu o tempo limite e foi interrompida.",
                "timeout"
              )
            )
          ),
        clampMs(timeoutMs)
      )
      const cancel = async () =>
        settle(() =>
          reject(new DataSourceError("Execução cancelada.", "cancelled"))
        )
      const onAbort = () => void cancel()
      if (signal?.aborted) return cancel()
      signal?.addEventListener("abort", onAbort, { once: true })
      onStart?.({ cancel })
      worker.on("message", (reply: WorkerReply) =>
        settle(() =>
          reply.ok ? resolve(reply) : reject(translateSqliteError(reply))
        )
      )
      worker.on("error", (error) =>
        settle(() => reject(translateSqliteError({ message: error.message })))
      )
      worker.on("exit", (code) => {
        if (code !== 0)
          settle(() =>
            reject(
              new DataSourceError(
                "O processo do SQLite terminou inesperadamente.",
                "query"
              )
            )
          )
      })
    })
  }

  async testConnection() {
    await this.runWorker({ op: "test" }, 10_000)
  }

  async execute(query: CompiledQuery, opts: ExecOptions): Promise<QueryResult> {
    const started = performance.now()
    const maxRows = Math.max(1, Math.trunc(opts.maxRows))
    const reply = await this.runWorker(
      { op: "execute", sql: query.sql, values: query.values, maxRows },
      opts.timeoutMs,
      opts.signal,
      opts.onStart
    )
    const rows = reply.rows ?? []
    const truncated = rows.length > maxRows
    const kept = truncated ? rows.slice(0, maxRows) : rows
    const columns: ResultColumn[] = (reply.columns ?? []).map((c, i) => {
      // Declared type when available; otherwise infer from the first value.
      const sample = kept.find(
        (row) => row[i] !== null && row[i] !== undefined
      )?.[i]
      const kind = c.type
        ? kindFromTypeName(c.type)
        : typeof sample === "number"
          ? Number.isInteger(sample)
            ? "integer"
            : "number"
          : typeof sample === "string"
            ? "text"
            : "unknown"
      return { name: c.name, kind, nativeType: c.type ?? "" }
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

  async executeWrite(
    query: CompiledQuery,
    opts: WriteOptions
  ): Promise<WriteResult> {
    const started = performance.now()
    const reply = await this.runWorker(
      {
        op: "write",
        sql: query.sql,
        values: query.values,
        maxAffectedRows: opts.maxAffectedRows,
        commit: opts.commit,
      },
      opts.timeoutMs
    )
    const affectedRows = reply.affectedRows ?? 0
    if (affectedRows > opts.maxAffectedRows) {
      throw tooManyRows(affectedRows, opts.maxAffectedRows)
    }
    return {
      affectedRows,
      committed: Boolean(reply.committed),
      durationMs: Math.round(performance.now() - started),
    }
  }

  async explain(
    query: CompiledQuery,
    opts: { timeoutMs: number }
  ): Promise<ExplainResult> {
    const reply = await this.runWorker(
      { op: "explain", sql: query.sql, values: query.values, maxRows: 1000 },
      opts.timeoutMs
    )
    return { plan: (reply.rows ?? []).map((row) => row.join(" | ")).join("\n") }
  }

  async cancel(handle: ExecutionHandle) {
    await handle.cancel()
  }

  async introspect(): Promise<SchemaInfo> {
    const reply = await this.runWorker({ op: "introspect" }, 60_000)
    const tables: SchemaTable[] = (reply.tables ?? []).map((t) => {
      const fkGroups = new Map<
        number,
        { columns: string[]; table: string; to: string[] }
      >()
      for (const fk of t.fks) {
        const group = fkGroups.get(fk.id) ?? {
          columns: [],
          table: fk.table,
          to: [],
        }
        group.columns.push(fk.from)
        group.to.push(fk.to)
        fkGroups.set(fk.id, group)
      }
      return {
        schema: "main",
        name: t.name,
        type: t.type === "view" ? "view" : "table",
        comment: null,
        columns: t.columns.map((c) => ({
          name: c.name,
          type: c.type,
          kind: kindFromTypeName(c.type),
          nullable: c.notnull === 0 && c.pk === 0,
          comment: null,
          primaryKey: c.pk > 0,
        })),
        foreignKeys: [...fkGroups.values()].map((g) => ({
          columns: g.columns,
          references: { schema: "main", table: g.table, columns: g.to },
        })),
        indexes: t.indexes.map((i) => ({ name: i.name, definition: i.sql })),
      }
    })
    return {
      serverVersion: `SQLite ${reply.version ?? ""}`,
      tables,
      introspectedAt: new Date().toISOString(),
    }
  }
}
