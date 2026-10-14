/**
 * Safe binding evaluator for `{{ ... }}` expressions in widget properties.
 *
 * Grammar (no operators, no calls, no code execution):
 *   expression := identifier ( "." identifier | "[" integer "]" | "[" 'string' "]" )*
 * Values are read only from own properties of plain objects and arrays, so
 * prototype tricks (`__proto__`, `constructor`) resolve to undefined.
 * Bindings never reach SQL text: query parameters receive the resulting values
 * through bind parameters.
 */

export type BindingScope = Record<string, unknown>

const TEMPLATE = /\{\{\s*([^{}]*?)\s*\}\}/g
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*/
const FORBIDDEN = new Set(["__proto__", "prototype", "constructor"])

export class BindingError extends Error {}

export type PathSegment = string | number

/** Parses `a.b[0]['c d']` into ["a", "b", 0, "c d"], or throws. */
export function parsePath(expression: string): PathSegment[] {
  const text = expression.trim()
  const segments: PathSegment[] = []
  let i = 0
  const first = IDENT.exec(text)
  if (!first) throw new BindingError(`Expressão inválida: "${expression}".`)
  segments.push(first[0])
  i = first[0].length
  while (i < text.length) {
    const ch = text[i]
    if (ch === ".") {
      const match = IDENT.exec(text.slice(i + 1))
      if (!match) throw new BindingError(`Expressão inválida: "${expression}".`)
      segments.push(match[0])
      i += 1 + match[0].length
    } else if (ch === "[") {
      const close = text.indexOf("]", i)
      if (close === -1)
        throw new BindingError(`Expressão inválida: "${expression}".`)
      const inner = text.slice(i + 1, close).trim()
      if (/^\d+$/.test(inner)) segments.push(Number(inner))
      else if (/^'[^'\\]*'$/.test(inner) || /^"[^"\\]*"$/.test(inner))
        segments.push(inner.slice(1, -1))
      else throw new BindingError(`Índice inválido em "${expression}".`)
      i = close + 1
    } else {
      throw new BindingError(`Expressão inválida: "${expression}".`)
    }
  }
  return segments
}

function isPlainContainer(
  value: unknown
): value is Record<string, unknown> | unknown[] {
  if (Array.isArray(value)) return true
  if (value === null || typeof value !== "object") return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** Reads a path from the scope without ever invoking code. */
export function readPath(scope: BindingScope, path: PathSegment[]): unknown {
  let current: unknown = scope
  for (const segment of path) {
    if (typeof segment === "string" && FORBIDDEN.has(segment)) return undefined
    if (!isPlainContainer(current)) return undefined
    if (Array.isArray(current)) {
      if (segment === "length") {
        current = current.length
        continue
      }
      if (typeof segment !== "number") return undefined
      current = current[segment]
    } else {
      if (!Object.prototype.hasOwnProperty.call(current, segment))
        return undefined
      current = (current as Record<string, unknown>)[String(segment)]
    }
  }
  return current
}

export function evaluateExpression(
  expression: string,
  scope: BindingScope
): unknown {
  return readPath(scope, parsePath(expression))
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

/**
 * Evaluates a property value. A string that is exactly one `{{ expr }}`
 * returns the raw value (arrays, objects, numbers); otherwise each binding is
 * interpolated as text. Invalid expressions evaluate to undefined/"".
 */
export function evaluateBinding(
  template: string,
  scope: BindingScope
): unknown {
  const whole = /^\{\{\s*([^{}]*?)\s*\}\}$/.exec(template.trim())
  if (whole) {
    try {
      return evaluateExpression(whole[1]!, scope)
    } catch {
      return undefined
    }
  }
  return template.replace(TEMPLATE, (_, expression: string) => {
    try {
      return stringify(evaluateExpression(expression, scope))
    } catch {
      return ""
    }
  })
}

export function hasBinding(text: string): boolean {
  return /\{\{[^{}]*\}\}/.test(text)
}

/** Root identifiers referenced by a template (for dependency tracking). */
export function bindingRoots(template: string): string[] {
  const roots = new Set<string>()
  for (const match of template.matchAll(TEMPLATE)) {
    try {
      roots.add(String(parsePath(match[1]!)[0]))
    } catch {
      // ignore invalid expressions
    }
  }
  return [...roots]
}

/** Validates every binding in a template, returning pt-BR error messages. */
export function validateBindings(template: string): string[] {
  const errors: string[] = []
  for (const match of template.matchAll(TEMPLATE)) {
    try {
      parsePath(match[1]!)
    } catch (error) {
      errors.push((error as Error).message)
    }
  }
  return errors
}
