import { analyzeSql, tokenize, type SqlDialect } from "./tokenizer"
import type { ParamDefinition, ParamType } from "./types"

const NAME_RULES: [RegExp, ParamType][] = [
  [
    /(^|_)(dt|data|date|dia|inicio|fim|desde)(_|$)|_(em|on)$|^(de|ate)$/i,
    "date",
  ],
  [/(_at$|datahora|timestamp|horario)/i, "datetime"],
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
  for (const [pattern, type] of NAME_RULES) {
    if (pattern.test(name)) return type
  }
  return "text"
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
