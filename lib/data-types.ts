/** Types shared by server and client for query results and schemas. */

export const COLUMN_KINDS = [
  "number",
  "integer",
  "decimal",
  "text",
  "date",
  "datetime",
  "boolean",
  "json",
  "unknown",
] as const

export type ColumnKind = (typeof COLUMN_KINDS)[number]

export type ResultColumn = {
  name: string
  kind: ColumnKind
  /** Native type name (e.g. "numeric", "int8", "varchar"). */
  nativeType: string
}

/** A cell as sent to the browser: big integers and decimals stay strings. */
export type Cell =
  string | number | boolean | null | Cell[] | { [key: string]: unknown }

export type QueryResult = {
  columns: ResultColumn[]
  rows: Cell[][]
  rowCount: number
  truncated: boolean
  durationMs: number
  /** Row limit applied to this execution. */
  limit: number
}

export type SchemaColumn = {
  name: string
  type: string
  kind: ColumnKind
  nullable: boolean
  comment: string | null
  primaryKey: boolean
}

export type SchemaForeignKey = {
  columns: string[]
  references: { schema: string; table: string; columns: string[] }
}

export type SchemaTable = {
  schema: string
  name: string
  type: "table" | "view"
  comment: string | null
  columns: SchemaColumn[]
  foreignKeys: SchemaForeignKey[]
  indexes: { name: string; definition: string }[]
}

export type SchemaInfo = {
  serverVersion: string
  tables: SchemaTable[]
  /** When the snapshot was taken (ISO). */
  introspectedAt: string
}

export const COLUMN_KIND_LABELS: Record<ColumnKind, string> = {
  number: "número",
  integer: "inteiro",
  decimal: "decimal",
  text: "texto",
  date: "data",
  datetime: "data e hora",
  boolean: "sim/não",
  json: "JSON",
  unknown: "outro",
}

export function isNumericKind(kind: ColumnKind) {
  return kind === "number" || kind === "integer" || kind === "decimal"
}

export function isTemporalKind(kind: ColumnKind) {
  return kind === "date" || kind === "datetime"
}
