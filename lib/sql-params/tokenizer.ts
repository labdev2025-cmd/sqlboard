/**
 * SQL parameter tokenizer.
 *
 * Splits SQL text into plain text, named parameters (`:name` and `{{name}}`)
 * and optional-clause markers (`[[` and `]]`). It never interprets parameter
 * markers inside string literals, quoted identifiers, comments or
 * dollar-quoted bodies, and it ignores the `::type` cast and the `:=` operator.
 *
 * Pure module: no database or framework dependencies.
 */

export type SqlDialect = "postgres" | "mysql" | "sqlite" | "mssql" | "oracle"

export type Token =
  | { kind: "text"; value: string }
  | {
      kind: "param"
      name: string
      raw: string
      syntax: "colon" | "braces"
      start: number
      end: number
    }
  | { kind: "optional-start"; start: number }
  | { kind: "optional-end"; start: number }

export class SqlParamError extends Error {
  constructor(
    message: string,
    public position?: number
  ) {
    super(message)
  }
}

const NAME_START = /[A-Za-z_]/
const NAME_PART = /[A-Za-z0-9_]/
const IDENT_PART = /[A-Za-z0-9_$]/

function readName(sql: string, from: number): number {
  let i = from
  while (i < sql.length && NAME_PART.test(sql[i]!)) i++
  return i
}

/** Index just past the closing quote of a quote-delimited token with doubled-quote escaping. */
function skipQuoted(
  sql: string,
  start: number,
  quote: string,
  backslashEscapes: boolean
): number {
  let i = start + 1
  while (i < sql.length) {
    const ch = sql[i]!
    if (backslashEscapes && ch === "\\") {
      i += 2
      continue
    }
    if (ch === quote) {
      if (sql[i + 1] === quote) {
        i += 2
        continue
      }
      return i + 1
    }
    i++
  }
  return sql.length
}

/** Matches a PostgreSQL dollar-quote opening tag (`$$` or `$tag$`) at `start`. */
function dollarTag(sql: string, start: number): string | null {
  if (sql[start] !== "$") return null
  const prev = sql[start - 1]
  if (prev && IDENT_PART.test(prev)) return null
  let i = start + 1
  if (sql[i] === "$") return "$$"
  if (!sql[i] || !NAME_START.test(sql[i]!)) return null
  while (i < sql.length && NAME_PART.test(sql[i]!)) i++
  return sql[i] === "$" ? sql.slice(start, i + 1) : null
}

/**
 * If a protected region (comment, string, quoted identifier, dollar-quoted
 * body) starts at `i`, returns the index just past it; otherwise null.
 */
function skipProtected(
  sql: string,
  i: number,
  dialect: SqlDialect
): number | null {
  const ch = sql[i]!
  const next = sql[i + 1]

  // -- line comment (MySQL also accepts "#" comments)
  if ((ch === "-" && next === "-") || (ch === "#" && dialect === "mysql")) {
    const end = sql.indexOf("\n", i)
    return end === -1 ? sql.length : end + 1
  }

  // /* block comment */ (PostgreSQL nests them)
  if (ch === "/" && next === "*") {
    let depth = 1
    let j = i + 2
    while (j < sql.length && depth > 0) {
      if (sql[j] === "/" && sql[j + 1] === "*" && dialect === "postgres") {
        depth++
        j += 2
      } else if (sql[j] === "*" && sql[j + 1] === "/") {
        depth--
        j += 2
      } else {
        j++
      }
    }
    return j
  }

  // 'string' ('' escaped; backslash escapes in E'...' and in MySQL)
  if (ch === "'") {
    const prev = sql[i - 1]
    const escapeString =
      (prev === "E" || prev === "e") &&
      !(sql[i - 2] && IDENT_PART.test(sql[i - 2]!))
    return skipQuoted(sql, i, "'", escapeString || dialect === "mysql")
  }

  // "quoted identifier" ("" escaped) and `backtick identifier`
  if (ch === '"' || ch === "`") return skipQuoted(sql, i, ch, false)

  // $$ ... $$ and $tag$ ... $tag$
  if (ch === "$" && dialect === "postgres") {
    const tag = dollarTag(sql, i)
    if (tag) {
      const close = sql.indexOf(tag, i + tag.length)
      return close === -1 ? sql.length : close + tag.length
    }
  }

  // [bracket identifier] in SQL Server (but not the [[ optional marker)
  if (ch === "[" && next !== "[" && dialect === "mssql") {
    return skipQuoted(sql, i, "]", false)
  }
  return null
}

export function tokenize(
  sql: string,
  dialect: SqlDialect = "postgres"
): Token[] {
  const tokens: Token[] = []
  let textStart = 0
  let i = 0

  const flushText = (until: number) => {
    if (until > textStart) {
      tokens.push({ kind: "text", value: sql.slice(textStart, until) })
    }
  }

  while (i < sql.length) {
    const ch = sql[i]!
    const next = sql[i + 1]

    const skipped = skipProtected(sql, i, dialect)
    if (skipped !== null) {
      i = skipped
      continue
    }

    // Optional clause markers
    if (ch === "[" && next === "[") {
      flushText(i)
      tokens.push({ kind: "optional-start", start: i })
      i += 2
      textStart = i
      continue
    }
    if (ch === "]" && next === "]") {
      flushText(i)
      tokens.push({ kind: "optional-end", start: i })
      i += 2
      textStart = i
      continue
    }

    // {{ name }}
    if (ch === "{" && next === "{") {
      const close = sql.indexOf("}}", i + 2)
      if (close === -1) {
        throw new SqlParamError("Parâmetro {{ sem fechamento }}.", i)
      }
      const name = sql.slice(i + 2, close).trim()
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        throw new SqlParamError(`Nome de parâmetro inválido: "${name}".`, i)
      }
      flushText(i)
      tokens.push({
        kind: "param",
        name,
        raw: sql.slice(i, close + 2),
        syntax: "braces",
        start: i,
        end: close + 2,
      })
      i = close + 2
      textStart = i
      continue
    }

    if (ch === ":") {
      // "::" cast: skip both colons and the type name that follows
      if (next === ":") {
        i += 2
        continue
      }
      // ":=" assignment / named-argument operator
      if (next === "=") {
        i += 2
        continue
      }
      const prev = sql[i - 1]
      if (
        next &&
        NAME_START.test(next) &&
        !(prev && (IDENT_PART.test(prev) || prev === ":"))
      ) {
        const end = readName(sql, i + 1)
        flushText(i)
        tokens.push({
          kind: "param",
          name: sql.slice(i + 1, end),
          raw: sql.slice(i, end),
          syntax: "colon",
          start: i,
          end,
        })
        i = end
        textStart = i
        continue
      }
    }

    i++
  }
  flushText(sql.length)
  return tokens
}

/** Distinct parameter names in order of first appearance. */
export function extractParamNames(
  sql: string,
  dialect: SqlDialect = "postgres"
): string[] {
  const seen = new Set<string>()
  for (const token of tokenize(sql, dialect)) {
    if (token.kind === "param") seen.add(token.name)
  }
  return [...seen]
}

export type SqlStructure = {
  params: string[]
  /** Parameter names of each optional clause, in order. */
  optionalClauses: string[][]
}

/** Parameters and optional clauses, validating that `[[ ]]` are balanced. */
export function analyzeSql(
  sql: string,
  dialect: SqlDialect = "postgres"
): SqlStructure {
  const tokens = tokenize(sql, dialect)
  const params = new Set<string>()
  const optionalClauses: string[][] = []
  let current: string[] | null = null
  for (const token of tokens) {
    if (token.kind === "optional-start") {
      if (current) {
        throw new SqlParamError(
          "Cláusulas opcionais [[ ]] não podem ser aninhadas.",
          token.start
        )
      }
      current = []
    } else if (token.kind === "optional-end") {
      if (!current) {
        throw new SqlParamError("]] sem [[ correspondente.", token.start)
      }
      if (current.length === 0) {
        throw new SqlParamError(
          "Cláusula opcional [[ ]] precisa ter pelo menos um parâmetro.",
          token.start
        )
      }
      optionalClauses.push(current)
      current = null
    } else if (token.kind === "param") {
      params.add(token.name)
      if (current && !current.includes(token.name)) current.push(token.name)
    }
  }
  if (current) throw new SqlParamError("[[ sem ]] correspondente.")
  return { params: [...params], optionalClauses }
}

/**
 * Replaces comments, strings, quoted identifiers and dollar-quoted bodies with
 * spaces, keeping offsets. Useful to inspect the "code" part of a statement.
 */
export function maskProtected(sql: string, dialect: SqlDialect = "postgres") {
  let out = ""
  let i = 0
  while (i < sql.length) {
    const skipped = skipProtected(sql, i, dialect)
    if (skipped !== null) {
      out += sql.slice(i, skipped).replace(/[^\n]/g, " ")
      i = skipped
    } else {
      out += sql[i]
      i++
    }
  }
  return out
}

/** Number of statements (top-level `;` separators; a trailing one is fine). */
export function countStatements(sql: string, dialect: SqlDialect = "postgres") {
  return maskProtected(sql, dialect)
    .split(";")
    .filter((part) => part.trim() !== "").length
}

/** Lower-case first keyword of the statement, ignoring comments and "(". */
export function leadingKeyword(sql: string, dialect: SqlDialect = "postgres") {
  const match = /^[\s(]*([A-Za-z]+)/.exec(maskProtected(sql, dialect))
  return match ? match[1]!.toLowerCase() : ""
}

const READ_KEYWORDS = new Set([
  "select",
  "with",
  "values",
  "table",
  "show",
  "explain",
  "pragma",
  "describe",
  "desc",
])

/** Read connections only accept a single statement that starts like a query. */
export function assertSingleReadStatement(
  sql: string,
  dialect: SqlDialect = "postgres"
) {
  const count = countStatements(sql, dialect)
  if (count === 0) throw new SqlParamError("A query está vazia.")
  if (count > 1) {
    throw new SqlParamError(
      "Envie um único comando por vez (sem ';' separando comandos)."
    )
  }
  const keyword = leadingKeyword(sql, dialect)
  if (!READ_KEYWORDS.has(keyword)) {
    throw new SqlParamError(
      `Somente consultas de leitura são permitidas (o comando começa com "${keyword.toUpperCase()}").`
    )
  }
}
