import {
  analyzeSql,
  SqlParamError,
  tokenize,
  type SqlDialect,
} from "./tokenizer"
import type {
  ParamDefinition,
  ParamType,
  RawParamValue,
  RawParamValues,
} from "./types"

/** A value ready for the driver (never interpolated into the SQL text). */
export type BoundValue = string | number | boolean | null | string[]

export type CompiledQuery = {
  /** SQL with dialect placeholders ($1, ?, @p1, :1). */
  sql: string
  /** Values in placeholder order. */
  values: BoundValue[]
  /** Normalized value of each parameter (after type coercion). */
  params: Record<string, BoundValue>
  /** Optional clauses removed because a parameter was empty. */
  removedClauses: number
}

export function isEmptyValue(value: RawParamValue | BoundValue): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === "string") return value.trim() === ""
  if (Array.isArray(value)) return value.length === 0
  return false
}

const INTEGER = /^[+-]?\d+$/
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})?$/

function validDate(text: string): boolean {
  const [y, m, d] = text.slice(0, 10).split("-").map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d!))
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m! - 1 &&
    date.getUTCDate() === d
  )
}

function label(def: ParamDefinition | undefined, name: string) {
  return def?.label ? `"${def.label}"` : `:${name}`
}

/** Converts a raw form value to the parameter's type, or throws a pt-BR error. */
export function coerceValue(
  name: string,
  raw: RawParamValue,
  def?: ParamDefinition
): BoundValue {
  const type: ParamType = def?.type ?? "text"
  if (isEmptyValue(raw)) return type === "multi" ? [] : null
  const fail = (what: string) => {
    throw new SqlParamError(`Parâmetro ${label(def, name)}: ${what}.`)
  }
  if (type === "multi") {
    const list = Array.isArray(raw) ? raw : [String(raw)]
    const values = list
      .map((item) => String(item))
      .filter((item) => item !== "")
    if (def?.options?.length) {
      const allowed = new Set(def.options.map((o) => o.value))
      if (values.some((v) => !allowed.has(v))) fail("opção inválida")
    }
    return values
  }
  if (Array.isArray(raw)) fail("esperava um único valor")
  const text = String(raw).trim()
  switch (type) {
    case "integer": {
      if (!INTEGER.test(text)) fail("informe um número inteiro")
      const n = Number(text)
      return Number.isSafeInteger(n) ? n : text.replace(/^\+/, "")
    }
    case "number": {
      const normalized = text.replace(",", ".")
      if (!DECIMAL.test(normalized)) fail("informe um número")
      const n = Number(normalized)
      // Keep the exact text when a JS number would lose precision.
      return String(n) === normalized ? n : normalized
    }
    case "date":
      if (!DATE.test(text) || !validDate(text))
        fail("data inválida (AAAA-MM-DD)")
      return text
    case "datetime":
      if (!DATETIME.test(text) || !validDate(text))
        fail("data e hora inválidas")
      return text
    case "boolean": {
      const lower = text.toLowerCase()
      if (["true", "1", "sim", "s", "yes"].includes(lower)) return true
      if (["false", "0", "não", "nao", "n", "no"].includes(lower)) return false
      return fail("use sim ou não")
    }
    case "list":
      if (def?.options?.length && !def.options.some((o) => o.value === text)) {
        fail("opção inválida")
      }
      return text
    default:
      return String(raw)
  }
}

type Placeholder = {
  /** Placeholder for the n-th distinct bind (1-based). */
  next: (index: number) => string
  reuse: boolean
}

const PLACEHOLDERS: Record<SqlDialect, Placeholder> = {
  postgres: { next: (n) => `$${n}`, reuse: true },
  mysql: { next: () => "?", reuse: false },
  sqlite: { next: () => "?", reuse: false },
  mssql: { next: (n) => `@p${n}`, reuse: true },
  oracle: { next: (n) => `:${n}`, reuse: false },
}

/**
 * Compiles SQL with named parameters into dialect placeholders and an ordered
 * values array. Optional clauses `[[ ... ]]` are removed when any parameter
 * inside them is empty. Values are never concatenated into the SQL text.
 */
export function compileSql(
  sql: string,
  rawValues: RawParamValues,
  options: { dialect?: SqlDialect; params?: ParamDefinition[] } = {}
): CompiledQuery {
  const dialect = options.dialect ?? "postgres"
  const defs = new Map((options.params ?? []).map((p) => [p.name, p]))
  const structure = analyzeSql(sql, dialect)

  const params: Record<string, BoundValue> = {}
  for (const name of structure.params) {
    const def = defs.get(name)
    params[name] = coerceValue(name, rawValues[name], def)
    if (def?.required && isEmptyValue(params[name])) {
      throw new SqlParamError(`Preencha o parâmetro ${label(def, name)}.`)
    }
  }

  const tokens = tokenize(sql, dialect)
  const style = PLACEHOLDERS[dialect]
  const values: BoundValue[] = []
  const assigned = new Map<string, string>()
  let out = ""
  let removedClauses = 0
  let clauseIndex = -1
  let skipping = false

  const bind = (value: BoundValue) => {
    values.push(value)
    return style.next(values.length)
  }

  for (const [index, token] of tokens.entries()) {
    if (token.kind === "optional-start") {
      clauseIndex++
      const names = structure.optionalClauses[clauseIndex] ?? []
      skipping = names.some((name) => isEmptyValue(params[name]))
      if (skipping) removedClauses++
      continue
    }
    if (token.kind === "optional-end") {
      skipping = false
      continue
    }
    if (skipping) continue
    if (token.kind === "text") {
      out += token.value
      continue
    }

    const name = token.name
    const value = params[name] ?? null
    const def = defs.get(name)
    const isMulti = Array.isArray(value)

    if (isMulti && dialect !== "postgres") {
      // Expansion IN (?, ?, ...) for dialects without array binds.
      const list = value as string[]
      if (list.length === 0) {
        throw new SqlParamError(
          `Parâmetro ${label(def, name)}: escolha pelo menos uma opção.`
        )
      }
      out += list.map((item) => bind(item)).join(", ")
      continue
    }
    if (isMulti && dialect === "postgres") {
      // The same SQL works on every database: "IN (:list)" becomes
      // "= ANY($n)" (and "NOT IN" becomes "<> ALL") with one array value.
      const next = tokens[index + 1]
      const opening = /\b(not\s+)?in\s*\(\s*$/i.exec(out)
      if (opening && next?.kind === "text" && /^\s*\)/.test(next.value)) {
        out = out.slice(0, opening.index) + (opening[1] ? "<> all(" : "= any(")
      }
    }
    if (style.reuse) {
      let placeholder = assigned.get(name)
      if (!placeholder) {
        placeholder = bind(value)
        assigned.set(name, placeholder)
      }
      out += placeholder
    } else {
      out += bind(value)
    }
  }

  return { sql: out, values, params, removedClauses }
}
