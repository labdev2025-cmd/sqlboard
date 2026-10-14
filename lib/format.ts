import type { Cell, ColumnKind } from "@/lib/data-types"

const LOCALE = "pt-BR"
const intFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })
const numFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 6 })

/** Groups thousands of a decimal string without converting it to a JS number. */
export function formatDecimalString(value: string): string {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(value.trim())
  if (!match) return value
  const [, sign, int, frac] = match
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `${sign === "-" ? "-" : ""}${grouped}${frac ? `,${frac}` : ""}`
}

/** Parses PostgreSQL/ISO date-time text ("2026-01-02 10:00:00+00"). */
export function parseDateTime(value: string): Date | null {
  const normalized = value.includes("T") ? value : value.replace(" ", "T")
  const withZone = /[+-]\d{2}$/.test(normalized)
    ? `${normalized}:00`
    : normalized
  const date = new Date(withZone)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value
}

export function formatCell(value: Cell, kind: ColumnKind): string {
  if (value === null || value === undefined) return "—"
  switch (kind) {
    case "integer":
      return typeof value === "number"
        ? intFormat.format(value)
        : formatDecimalString(String(value))
    case "decimal":
    case "number":
      return typeof value === "number"
        ? numFormat.format(value)
        : formatDecimalString(String(value))
    case "date":
      return formatDate(String(value))
    case "datetime": {
      const date = parseDateTime(String(value))
      return date
        ? date.toLocaleString(LOCALE, {
            dateStyle: "short",
            timeStyle: "short",
          })
        : String(value)
    }
    case "boolean":
      return value === true || value === "true" ? "Sim" : "Não"
    case "json":
      return typeof value === "string" ? value : JSON.stringify(value)
    default:
      return typeof value === "object" ? JSON.stringify(value) : String(value)
  }
}

/** Numeric value for sorting and charts (decimal strings become numbers). */
export function toNumber(value: Cell): number | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number") return value
  if (typeof value === "boolean") return value ? 1 : 0
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const DECIMAL = /^([+-]?)0*(\d*?)(?:\.(\d*?)0*)?$/

/**
 * Exact order of two decimal strings (int8/numeric beyond 2^53 lose precision
 * as JS numbers). Returns null when either is not a plain decimal.
 */
export function compareDecimalStrings(a: string, b: string): number | null {
  const ma = DECIMAL.exec(a.trim())
  const mb = DECIMAL.exec(b.trim())
  if (!ma || !mb || !/\d/.test(a) || !/\d/.test(b)) return null
  const parse = (m: RegExpExecArray) => {
    const int = m[2] ?? ""
    const frac = m[3] ?? ""
    const zero = !/[1-9]/.test(int + frac)
    return { neg: m[1] === "-" && !zero, int, frac }
  }
  const x = parse(ma)
  const y = parse(mb)
  if (x.neg !== y.neg) return x.neg ? -1 : 1
  let order =
    x.int.length - y.int.length || (x.int < y.int ? -1 : x.int > y.int ? 1 : 0)
  if (order === 0) {
    const len = Math.max(x.frac.length, y.frac.length)
    const fx = x.frac.padEnd(len, "0")
    const fy = y.frac.padEnd(len, "0")
    order = fx < fy ? -1 : fx > fy ? 1 : 0
  }
  return x.neg ? -order : order
}

/** Comparator that respects the column kind (numbers, dates, text). */
export function compareCells(a: Cell, b: Cell, kind: ColumnKind): number {
  if (a === null || a === undefined)
    return b === null || b === undefined ? 0 : 1
  if (b === null || b === undefined) return -1
  if (kind === "integer" || kind === "decimal" || kind === "number") {
    if (typeof a === "string" && typeof b === "string") {
      const exact = compareDecimalStrings(a, b)
      if (exact !== null) return exact
    }
    return (toNumber(a) ?? 0) - (toNumber(b) ?? 0)
  }
  if (kind === "boolean") return Number(a === true) - Number(b === true)
  return String(a).localeCompare(String(b), LOCALE, { numeric: true })
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} s`
}

export function formatCount(n: number): string {
  return intFormat.format(n)
}
