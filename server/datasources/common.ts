import type { Cell, ColumnKind } from "@/lib/data-types"

/** Column kind from a SQL type name (used by every dialect's introspection). */
export function kindFromTypeName(
  typeName: string | null | undefined
): ColumnKind {
  const name = (typeName ?? "").toLowerCase().replace(/\(.*$/, "").trim()
  if (!name) return "unknown"
  if (
    /^(tinyint|smallint|mediumint|int|integer|bigint|int2|int4|int8|serial|bigserial|year)\b/.test(
      name
    )
  )
    return "integer"
  if (/^(decimal|numeric|money|smallmoney|number)\b/.test(name))
    return "decimal"
  if (/^(float|double|real|binary_float|binary_double)/.test(name))
    return "number"
  if (/^(bit|bool|boolean)$/.test(name)) return "boolean"
  if (/^date$/.test(name)) return "date"
  if (/^(datetime|datetime2|smalldatetime|datetimeoffset|timestamp)/.test(name))
    return "datetime"
  if (/^(json|jsonb)$/.test(name)) return "json"
  if (
    /(char|text|clob|uniqueidentifier|uuid|enum|set|string|xml|time)/.test(name)
  )
    return "text"
  return "unknown"
}

export function clampMs(value: number) {
  return Math.max(100, Math.min(Math.trunc(value), 15 * 60_000))
}

/** Normalizes a driver value into a JSON-safe cell (precision preserved). */
export function toCell(value: unknown): Cell {
  if (value === null || value === undefined) return null
  if (typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number")
    return Number.isFinite(value) ? value : String(value)
  if (typeof value === "bigint") {
    return Number.isSafeInteger(Number(value))
      ? Number(value)
      : value.toString()
  }
  if (value instanceof Date) return value.toISOString()
  if (Buffer.isBuffer(value) || value instanceof Uint8Array)
    return `\\x${Buffer.from(value).toString("hex")}`
  if (Array.isArray(value)) return value.map(toCell)
  if (typeof value === "object") return value as Record<string, unknown>
  return String(value)
}
