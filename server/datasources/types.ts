import type { CompiledQuery } from "@/lib/sql-params"
import type { SqlDialect } from "@/lib/sql-params"
import type { ColumnKind, QueryResult, SchemaInfo } from "@/lib/data-types"

export type ConnectionConfig = {
  /** Stable key for pooling (connection id + last update). */
  key: string
  dialect: SqlDialect
  host: string
  port: number | null
  database: string
  username: string
  password: string | null
  ssl: "disable" | "require" | "verify-full"
  statementTimeoutMs: number
}

export type ExecOptions = {
  /** Maximum rows returned; one extra row is read to detect truncation. */
  maxRows: number
  timeoutMs: number
  signal?: AbortSignal
  /** Called with a handle as soon as the query is running (for cancel buttons). */
  onStart?: (handle: ExecutionHandle) => void
}

export type ExecutionHandle = { cancel: () => Promise<void> }

export type ExplainResult = { plan: string }

export type WriteOptions = {
  timeoutMs: number
  /** More affected rows than this rolls the transaction back. */
  maxAffectedRows: number
  /** false = preview: run inside the transaction, then roll back. */
  commit: boolean
}

export type WriteResult = {
  affectedRows: number
  committed: boolean
  durationMs: number
}

/** Contract every database adapter implements (PROMPT.md §3.3). */
export interface DataSourceAdapter {
  readonly dialect: SqlDialect
  readonly placeholderStyle: "dollar" | "question" | "at" | "colon"
  testConnection(): Promise<void>
  introspect(): Promise<SchemaInfo>
  execute(query: CompiledQuery, opts: ExecOptions): Promise<QueryResult>
  explain(
    query: CompiledQuery,
    opts: { timeoutMs: number }
  ): Promise<ExplainResult>
  cancel(handle: ExecutionHandle): Promise<void>
  /** Write actions (F6): one INSERT/UPDATE in its own transaction. */
  executeWrite(query: CompiledQuery, opts: WriteOptions): Promise<WriteResult>
  mapType(native: unknown): ColumnKind
  close(): Promise<void>
}

/** Error with a user-facing (pt-BR) message translated from the driver error. */
export class DataSourceError extends Error {
  constructor(
    message: string,
    public code: "cancelled" | "timeout" | "connection" | "query" | "forbidden",
    public detail?: string
  ) {
    super(message)
  }
}

export function tooManyRows(affected: number, max: number) {
  return new DataSourceError(
    `O comando afetaria ${affected} linha(s), acima do limite de ${max} desta ação. Nada foi gravado.`,
    "forbidden"
  )
}
