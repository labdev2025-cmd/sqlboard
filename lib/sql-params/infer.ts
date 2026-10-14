import { analyzeSql, tokenize, type SqlDialect } from "./tokenizer"
import type { ParamDefinition, ParamType } from "./types"

const NAME_RULES: [RegExp, ParamType][] = [
  [
    /(_at$|data_?hora|dt_?hora|datetime|timestamp|horario|momento)/i,
    "datetime",
  ],
  [
    /(^|_)(dt|data|date|dia|inicio|fim|desde)(_|$)|_(em|on)$|^(de|ate)$/i,
    "date",
  ],
  [/(^|_)(ids|status_list|lista)$/i, "multi"],
  [
    /(^|_)(id|qtd|quantidade|limite|limit|ano|mes|top|n|offset|pagina)(_|$)/i,
    "integer",
  ],
  [
    /(^|_)(valor|preco|total|minimo|maximo|min|max|percentual|taxa)(_|$)/i,
    "number",
  ],
  [/^(is|tem|possui|somente|apenas|ativo|ativa|flag)(_|$)/i, "boolean"],
]

/**
 * Suggests a parameter type from its name and from how it is used in the SQL
 * (`IN (:x)`/`ANY(:x)` → multi, `LIMIT :n` → integer). Always editable.
 */
export function inferParamType(
  name: string,
  sql: string,
  dialect: SqlDialect = "postgres"
): ParamType {
  const tokens = tokenize(sql, dialect)
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    if (token.kind !== "param" || token.name !== name) continue
    const before = tokens[i - 1]
    const text = before?.kind === "text" ? before.value : ""
    if (/\b(in|any)\s*\(\s*$/i.test(text)) return "multi"
    if (/\b(limit|offset|top|fetch\s+first)\s*\(?\s*$/i.test(text)) {
      return "integer"
    }
  }
  const byName = typeFromName(name)
  if (byName) return byName
  // Compared with a column: the column name tells the type
  // (`data_pedido >= :desde`, `valor BETWEEN :a AND :b`).
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    if (token.kind !== "param" || token.name !== name) continue
    const before = tokens[i - 1]
    const text = before?.kind === "text" ? before.value : ""
    const column =
      /([A-Za-z_][A-Za-z0-9_]*)["`\]]?\s*(=|<>|!=|<=|>=|<|>)\s*$/.exec(
        text
      )?.[1] ??
      /([A-Za-z_][A-Za-z0-9_]*)["`\]]?\s+between\s*$/i.exec(text)?.[1] ??
      betweenUpperBound(tokens, i)
    const byColumn = column ? typeFromName(column) : null
    if (byColumn && byColumn !== "multi") return byColumn
  }
  return "text"
}

function typeFromName(name: string): ParamType | null {
  for (const [pattern, type] of NAME_RULES) {
    if (pattern.test(name)) return type
  }
  return null
}

/** `col BETWEEN :a AND :b`: the column of the upper bound `:b`. */
function betweenUpperBound(
  tokens: ReturnType<typeof tokenize>,
  index: number
): string | undefined {
  const and = tokens[index - 1]
  const lower = tokens[index - 2]
  const between = tokens[index - 3]
  if (
    and?.kind !== "text" ||
    !/^\s*and\s*$/i.test(and.value) ||
    lower?.kind !== "param" ||
    between?.kind !== "text"
  ) {
    return undefined
  }
  return /([A-Za-z_][A-Za-z0-9_]*)["`\]]?\s+between\s*$/i.exec(
    between.value
  )?.[1]
}

/**
 * Detects the parameters of `sql` and merges them with existing definitions:
 * known parameters keep their settings, new ones get an inferred type, and
 * parameters no longer present are dropped.
 */
export function syncParams(
  sql: string,
  existing: ParamDefinition[],
  dialect: SqlDialect = "postgres"
): ParamDefinition[] {
  const { params, optionalClauses } = analyzeSql(sql, dialect)
  const optional = new Set(optionalClauses.flat())
  const byName = new Map(existing.map((p) => [p.name, p]))
  return params.map(
    (name) =>
      byName.get(name) ?? {
        name,
        type: inferParamType(name, sql, dialect),
        required: !optional.has(name),
      }
  )
}
