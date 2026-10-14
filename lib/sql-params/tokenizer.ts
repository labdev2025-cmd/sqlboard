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

/**
 * Scans a quote-delimited token with doubled-quote escaping; returns the
 * index just past the closing quote and whether that quote was found.
 */
function quoted(
  sql: string,
  start: number,
  quote: string,
  backslashEscapes: boolean
): { end: number; closed: boolean } {
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
      return { end: i + 1, closed: true }
    }
    i++
  }
  return { end: sql.length, closed: false }
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

/** Characters MySQL accepts after "--" to start a comment. */
const MYSQL_DASH_COMMENT_END = /[\s\x00-\x1f]/

/**
 * If a protected region (comment, string, quoted identifier, dollar-quoted
 * body) starts at `i`, returns where it ends and whether it was properly
 * closed; otherwise null. The rules follow each server's lexer: any
 * disagreement would let code hide inside what we think is a comment.
 */
function scanProtected(
  sql: string,
  i: number,
  dialect: SqlDialect
): { end: number; closed: boolean } | null {
  const ch = sql[i]!
  const next = sql[i + 1]

  // -- line comment. MySQL needs whitespace (or the end) after "--":
  // "1 --1" is "1 - -1" there. MySQL also accepts "#" comments.
  const dashComment =
    ch === "-" &&
    next === "-" &&
    (dialect !== "mysql" ||
      i + 2 >= sql.length ||
      MYSQL_DASH_COMMENT_END.test(sql[i + 2]!))
  if (dashComment || (ch === "#" && dialect === "mysql")) {
    const end = sql.indexOf("\n", i)
    return { end: end === -1 ? sql.length : end + 1, closed: true }
  }

  // /* block comment */ (PostgreSQL and SQL Server nest them)
  if (ch === "/" && next === "*") {
    const nests = dialect === "postgres" || dialect === "mssql"
    let depth = 1
    let j = i + 2
    while (j < sql.length && depth > 0) {
      if (sql[j] === "/" && sql[j + 1] === "*" && nests) {
        depth++
        j += 2
      } else if (sql[j] === "*" && sql[j + 1] === "/") {
        depth--
        j += 2
      } else {
        j++
      }
    }
    return { end: j, closed: depth === 0 }
  }

  // 'string' ('' escaped; backslash escapes in E'...' and in MySQL)
  if (ch === "'") {
    const prev = sql[i - 1]
    const escapeString =
      (prev === "E" || prev === "e") &&
      !(sql[i - 2] && IDENT_PART.test(sql[i - 2]!))
    return quoted(sql, i, "'", escapeString || dialect === "mysql")
  }

  // "quoted identifier" ("" escaped; a backslash-escaped string in MySQL)
  // and `backtick identifier`
  if (ch === '"') return quoted(sql, i, ch, dialect === "mysql")
  if (ch === "`") return quoted(sql, i, ch, false)

  // $$ ... $$ and $tag$ ... $tag$
  if (ch === "$" && dialect === "postgres") {
    const tag = dollarTag(sql, i)
    if (tag) {
      const close = sql.indexOf(tag, i + tag.length)
      return close === -1
        ? { end: sql.length, closed: false }
        : { end: close + tag.length, closed: true }
    }
  }

  // [bracket identifier] in SQL Server (but not the [[ optional marker)
  if (ch === "[" && next !== "[" && dialect === "mssql") {
    return quoted(sql, i, "]", false)
  }
  return null
}

function skipProtected(
  sql: string,
  i: number,
  dialect: SqlDialect
): number | null {
  return scanProtected(sql, i, dialect)?.end ?? null
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
/** Lower-case words of the code part (outside strings and comments). */
function codeWords(sql: string, dialect: SqlDialect): string[] {
  return (
    maskProtected(sql, dialect)
      .toLowerCase()
      .match(/[a-z_][a-z0-9_$#]*/g) ?? []
  )
}

/**
 * T-SQL runs a whole batch without needing ";" between statements, and the
 * driver sends the text through sp_executesql. Reserved words that start
 * another statement (or end the wrapping transaction) are refused anywhere
 * in the code: as reserved words they can only appear unquoted as commands.
 */
const MSSQL_FORBIDDEN = new Set([
  "insert",
  "update",
  "delete",
  "merge",
  "exec",
  "execute",
  "commit",
  "rollback",
  "save",
  "begin",
  "declare",
  "set",
  "into",
  "waitfor",
  "drop",
  "create",
  "alter",
  "truncate",
  "grant",
  "revoke",
  "deny",
  "use",
  "backup",
  "restore",
  "dbcc",
  "kill",
  "shutdown",
  "reconfigure",
  "bulk",
  "openrowset",
  "opendatasource",
  "openquery",
])

/**
 * Refuses text whose comments, strings or quoted identifiers never close:
 * the server would reject or read them differently, and the validators
 * below must see exactly what the server will run.
 */
function assertTerminated(sql: string, dialect: SqlDialect) {
  let i = 0
  while (i < sql.length) {
    const region = scanProtected(sql, i, dialect)
    if (!region) {
      i++
      continue
    }
    if (!region.closed) {
      throw new SqlParamError(
        "Há um comentário, texto entre aspas ou identificador sem fechamento.",
        i
      )
    }
    if (dialect === "mysql") {
      const body = sql.slice(i, region.end)
      // /*! ... */ and /*M! ... */ are executed by MySQL/MariaDB, and the
      // SET_VAR hint changes session settings for the statement.
      if (
        /^\/\*M?!/.test(body) ||
        (/^\/\*\+/.test(body) && /set_var/i.test(body))
      ) {
        throw new SqlParamError(
          "Comentários executáveis (/*! */) e a dica SET_VAR não são permitidos.",
          i
        )
      }
    }
    i = region.end
  }
}

function assertDialectSafe(
  sql: string,
  dialect: SqlDialect,
  allowed: ReadonlySet<string> = new Set()
) {
  assertTerminated(sql, dialect)
  if (dialect === "mssql") {
    const word = codeWords(sql, dialect).find(
      (w) => MSSQL_FORBIDDEN.has(w) && !allowed.has(w)
    )
    if (word) {
      throw new SqlParamError(
        `No SQL Server, "${word.toUpperCase()}" não é permitido aqui (o banco executaria mais de um comando).`
      )
    }
  }
  if (dialect === "mysql") {
    const code = maskProtected(sql, dialect)
    if (/\binto\s+(outfile|dumpfile)\b|\bload_file\s*\(/i.test(code)) {
      throw new SqlParamError(
        "Ler ou gravar arquivos do servidor (INTO OUTFILE, LOAD_FILE) não é permitido."
      )
    }
  }
}

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
  assertDialectSafe(sql, dialect)
}

const WRITE_KEYWORDS = new Set(["insert", "update"])

/**
 * Write actions (F6): a single explicit INSERT or UPDATE. UPDATE needs a
 * WHERE clause (outside strings and comments) and optional clauses are not
 * allowed, so the statement that runs is always the one that was reviewed.
 */
export function assertSingleWriteStatement(
  sql: string,
  dialect: SqlDialect = "postgres"
) {
  const count = countStatements(sql, dialect)
  if (count === 0) throw new SqlParamError("O comando está vazio.")
  if (count > 1) {
    throw new SqlParamError(
      "Envie um único comando por vez (sem ';' separando comandos)."
    )
  }
  const keyword = leadingKeyword(sql, dialect)
  if (!WRITE_KEYWORDS.has(keyword)) {
    throw new SqlParamError(
      `Ações de escrita aceitam só INSERT ou UPDATE (o comando começa com "${keyword.toUpperCase() || "?"}").`
    )
  }
  const code = maskProtected(sql, dialect)
  if (/\[\[|\]\]/.test(code)) {
    throw new SqlParamError(
      "Cláusulas opcionais [[ ]] não são permitidas em ações de escrita."
    )
  }
  if (keyword === "update" && !hasTopLevelWhere(code)) {
    throw new SqlParamError("UPDATE sem WHERE não é permitido.")
  }
  const commands = codeWords(sql, dialect).filter((w) =>
    ["insert", "update", "delete", "merge"].includes(w)
  )
  if (commands.length > 1) {
    throw new SqlParamError("Envie um único INSERT ou UPDATE por ação.")
  }
  assertDialectSafe(sql, dialect, new Set([keyword, "set", "into"]))
}

/** WHERE at parenthesis depth 0 (a WHERE inside a subquery does not count). */
function hasTopLevelWhere(code: string) {
  let depth = 0
  for (const match of code.matchAll(/[()]|\bwhere\b/gi)) {
    if (match[0] === "(") depth++
    else if (match[0] === ")") depth = Math.max(0, depth - 1)
    else if (depth === 0) return true
  }
  return false
}
