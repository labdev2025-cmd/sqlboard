/**
 * "Melhorar com IA" by copy and paste (PROMPT.md §4.5).
 *
 * Builds a ready-to-paste prompt for any chat AI and validates the pasted
 * answer. Pure module: no React, no network. By construction it never
 * receives result rows, credentials, host or connection name.
 */
import type { Cell, ResultColumn, SchemaTable } from "@/lib/data-types"
import {
  analyzeSql,
  countStatements,
  maskProtected,
  SqlParamError,
  type ParamDefinition,
  type SqlDialect,
} from "@/lib/sql-params"
import { PARAM_TYPE_LABELS } from "@/lib/sql-params/types"

export const DIALECT_NAMES: Record<SqlDialect, string> = {
  postgres: "PostgreSQL",
  mysql: "MySQL/MariaDB",
  sqlite: "SQLite",
  mssql: "SQL Server (T-SQL)",
  oracle: "Oracle",
}

export type PromptContext = {
  serverVersion?: string
  tables?: SchemaTable[]
  params?: ParamDefinition[]
  lastRun?: { durationMs: number; rowCount: number; truncated: boolean }
  plan?: string
}

export type PromptInclude = {
  version: boolean
  tables: boolean
  params: boolean
  metrics: boolean
  plan: boolean
}

/** Everything on except the plan (it needs an extra EXPLAIN round-trip). */
export const DEFAULT_INCLUDE: PromptInclude = {
  version: true,
  tables: true,
  params: true,
  metrics: true,
  plan: false,
}

/** Tables/views whose name appears as an identifier in the SQL code. */
export function referencedTables(
  sql: string,
  tables: SchemaTable[],
  dialect: SqlDialect = "postgres"
): SchemaTable[] {
  const code = maskProtected(sql, dialect).toLowerCase()
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return tables.filter((table) => {
    const name = escape(table.name.toLowerCase())
    return new RegExp(
      `(^|[^a-z0-9_$])("?${escape(table.schema.toLowerCase())}"?\\.)?"?${name}"?($|[^a-z0-9_$])`
    ).test(code)
  })
}

export function describeTable(table: SchemaTable): string {
  const lines = [
    `### ${table.type === "view" ? "View" : "Tabela"} ${table.schema}.${table.name}${table.comment ? ` — ${table.comment}` : ""}`,
    "Colunas:",
    ...table.columns.map(
      (c) =>
        `- ${c.name} ${c.type}${c.nullable ? "" : " NOT NULL"}${c.primaryKey ? " (chave primária)" : ""}${c.comment ? ` — ${c.comment}` : ""}`
    ),
  ]
  if (table.foreignKeys.length) {
    lines.push(
      "Chaves estrangeiras:",
      ...table.foreignKeys.map(
        (fk) =>
          `- (${fk.columns.join(", ")}) → ${fk.references.schema}.${fk.references.table}(${fk.references.columns.join(", ")})`
      )
    )
  }
  lines.push(
    "Índices:",
    ...(table.indexes.length
      ? table.indexes.map((i) => `- ${i.definition}`)
      : ["- nenhum"])
  )
  return lines.join("\n")
}

export function buildAiPrompt(options: {
  sql: string
  dialect: SqlDialect
  context: PromptContext
  include?: Partial<PromptInclude>
}): string {
  const include = { ...DEFAULT_INCLUDE, ...options.include }
  const { context } = options
  const dialect = DIALECT_NAMES[options.dialect]
  const structure = safeStructure(options.sql, options.dialect)

  const sections: string[] = []
  sections.push(
    [
      "Você é especialista em SQL e otimização de consultas.",
      `Melhore a query ${dialect} abaixo em desempenho, legibilidade e correção, SEM mudar o resultado:`,
      "- mesmas colunas, com os mesmos nomes/aliases e na mesma ordem;",
      "- mesmas linhas (mesmo conjunto de dados e mesma ordenação, se houver ORDER BY);",
      `- mantenha o dialeto ${dialect};`,
      "- mantenha EXATAMENTE os mesmos parâmetros (`:nome` ou `{{nome}}`), sem trocar por valores;",
      "- mantenha as cláusulas opcionais `[[ ... ]]` (o trecho some quando o parâmetro está vazio);",
      "- um único comando, somente leitura (SELECT/WITH), sem ponto e vírgula separando comandos.",
      "Responda SOMENTE com a query final dentro de um bloco ```sql```, sem explicações.",
    ].join("\n")
  )

  const ctx: string[] = []
  if (include.version && context.serverVersion) {
    ctx.push(`Banco: ${context.serverVersion}`)
  }
  if (include.tables && context.tables?.length) {
    ctx.push(
      [
        "## Tabelas e views referenciadas",
        ...context.tables.map(describeTable),
      ].join("\n\n")
    )
  }
  if (include.params) {
    const params = structure?.params ?? []
    if (params.length) {
      const defs = new Map((context.params ?? []).map((p) => [p.name, p]))
      const optional = new Set(structure?.optionalClauses.flat() ?? [])
      ctx.push(
        [
          "## Parâmetros",
          ...params.map((name) => {
            const def = defs.get(name)
            const type = def
              ? PARAM_TYPE_LABELS[def.type]
              : PARAM_TYPE_LABELS.text
            return `- :${name} — ${type}${def?.required ? ", obrigatório" : ""}${optional.has(name) ? ", dentro de cláusula opcional [[ ]]" : ""}`
          }),
        ].join("\n")
      )
    } else {
      ctx.push("## Parâmetros\nA query não tem parâmetros.")
    }
  }
  if (include.metrics && context.lastRun) {
    const { durationMs, rowCount, truncated } = context.lastRun
    ctx.push(
      `## Última execução\nTempo: ${durationMs} ms · Linhas: ${rowCount}${truncated ? " (resultado truncado pelo limite de linhas)" : ""}`
    )
  }
  if (include.plan && context.plan) {
    ctx.push(
      `## Plano de execução (EXPLAIN, sem ANALYZE)\n\`\`\`\n${context.plan}\n\`\`\``
    )
  }
  if (ctx.length) sections.push(["# Contexto", ...ctx].join("\n\n"))

  sections.push(["# Query", "```sql", options.sql.trim(), "```"].join("\n"))
  return sections.join("\n\n") + "\n"
}

function safeStructure(sql: string, dialect: SqlDialect) {
  try {
    return analyzeSql(sql, dialect)
  } catch {
    return null
  }
}

/** Extracts the SQL from the AI answer: first ```sql block, else any block, else all text. */
export function extractSqlFromResponse(text: string): string {
  const sqlBlock = /```\s*sql\s*\n([\s\S]*?)```/i.exec(text)
  if (sqlBlock) return sqlBlock[1]!.trim()
  const anyBlock = /```[a-z]*\s*\n([\s\S]*?)```/i.exec(text)
  if (anyBlock) return anyBlock[1]!.trim()
  return text.trim()
}

export type ImprovedCheck = {
  ok: boolean
  errors: string[]
  warnings: string[]
  missingParams: string[]
  extraParams: string[]
}

/** Validates the improved query against the original (PROMPT.md §4.5, tab 2). */
export function checkImprovedQuery(
  original: string,
  improved: string,
  dialect: SqlDialect = "postgres"
): ImprovedCheck {
  const errors: string[] = []
  const warnings: string[] = []
  if (!improved.trim()) {
    return {
      ok: false,
      errors: ["Cole a resposta da IA."],
      warnings,
      missingParams: [],
      extraParams: [],
    }
  }
  let before: ReturnType<typeof analyzeSql> | null = null
  let after: ReturnType<typeof analyzeSql> | null = null
  try {
    before = analyzeSql(original, dialect)
  } catch {
    before = null
  }
  try {
    after = analyzeSql(improved, dialect)
  } catch (error) {
    errors.push(
      error instanceof SqlParamError
        ? error.message
        : "Não foi possível ler a query."
    )
  }
  if (countStatements(improved, dialect) > 1) {
    errors.push("A resposta tem mais de um comando. Envie só um.")
  }
  const beforeParams = new Set(before?.params ?? [])
  const afterParams = new Set(after?.params ?? [])
  const missingParams = [...beforeParams].filter((p) => !afterParams.has(p))
  const extraParams = [...afterParams].filter((p) => !beforeParams.has(p))
  if (missingParams.length)
    warnings.push(
      `Parâmetros que sumiram: ${missingParams.map((p) => `:${p}`).join(", ")}.`
    )
  if (extraParams.length)
    warnings.push(
      `Parâmetros novos: ${extraParams.map((p) => `:${p}`).join(", ")}.`
    )
  if (before && after) {
    const key = (clauses: string[][]) =>
      clauses
        .map((c) => [...c].sort().join(","))
        .sort()
        .join(";")
    if (key(before.optionalClauses) !== key(after.optionalClauses)) {
      warnings.push(
        "As cláusulas opcionais [[ ]] mudaram em relação à original."
      )
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    missingParams,
    extraParams,
  }
}

export type RunSummary = {
  columns: ResultColumn[]
  rows: Cell[][]
  truncated: boolean
}

export type ComparisonVerdict = "identical" | "different" | "inconclusive"

/** Order-insensitive fingerprint of the rows (multiset of serialized rows). */
export function rowsFingerprint(rows: Cell[][]): string {
  return rows
    .map((row) => JSON.stringify(row))
    .sort()
    .join("\n")
}

/**
 * Compares two executions: same column names in the same order and the same
 * rows (in the same order when the original has ORDER BY). When either side
 * hit the row limit the verdict is inconclusive.
 */
/** True when the statement ends with an ORDER BY at the top level. */
export function hasTopLevelOrderBy(
  sql: string,
  dialect: SqlDialect = "postgres"
): boolean {
  const code = maskProtected(sql, dialect)
  let depth = 0
  let found = false
  for (const match of code.matchAll(/[()]|\border\s+by\b/gi)) {
    if (match[0] === "(") depth++
    else if (match[0] === ")") depth = Math.max(0, depth - 1)
    else if (depth === 0) found = true
  }
  return found
}

export function compareRuns(
  a: RunSummary,
  b: RunSummary,
  options: { ordered?: boolean } = {}
): {
  verdict: ComparisonVerdict
  reasons: string[]
} {
  const reasons: string[] = []
  const namesA = a.columns.map((c) => c.name)
  const namesB = b.columns.map((c) => c.name)
  if (namesA.join("\u0000") !== namesB.join("\u0000")) {
    reasons.push(
      `Colunas diferentes: (${namesA.join(", ")}) × (${namesB.join(", ")}).`
    )
  }
  if (a.rows.length !== b.rows.length) {
    reasons.push(
      `Quantidade de linhas diferente: ${a.rows.length} × ${b.rows.length}.`
    )
  } else if (rowsFingerprint(a.rows) !== rowsFingerprint(b.rows)) {
    reasons.push("Os valores das linhas são diferentes.")
  } else if (
    options.ordered &&
    a.rows.some((row, i) => JSON.stringify(row) !== JSON.stringify(b.rows[i]))
  ) {
    // The original has ORDER BY: the improved query must keep the order.
    reasons.push("Mesmas linhas, mas em outra ordem.")
  }
  if (a.truncated || b.truncated) {
    return {
      verdict: "inconclusive",
      reasons: [
        ...reasons,
        "O limite de linhas truncou o resultado; não dá para concluir que são idênticos.",
      ],
    }
  }
  return { verdict: reasons.length ? "different" : "identical", reasons }
}
