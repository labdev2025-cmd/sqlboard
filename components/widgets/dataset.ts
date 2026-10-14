import {
  bindingRoots,
  evaluateBinding,
  type BindingScope,
} from "@/lib/bindings"
import type { Cell, ColumnKind, ResultColumn } from "@/lib/data-types"

export type Dataset = {
  columns: ResultColumn[]
  rows: Cell[][]
  truncated: boolean
  loading: boolean
  error: string | null
  /** Name of the source query, when the binding points at one. */
  source: string | null
  /** Required parameters still empty (the query is waiting for them). */
  missing: string[]
}

function inferKind(values: unknown[]): ColumnKind {
  const sample = values.find((v) => v !== null && v !== undefined)
  if (typeof sample === "number")
    return Number.isInteger(sample) ? "integer" : "number"
  if (typeof sample === "boolean") return "boolean"
  if (typeof sample === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sample))
    return "date"
  if (typeof sample === "object") return "json"
  return "text"
}

/**
 * Resolves `bindings.data` into columns + rows. `{{q.data}}` keeps the query's
 * typed columns; other expressions (arrays of objects) get inferred kinds.
 */
export function resolveDataset(
  binding: string | undefined,
  scope: BindingScope
): Dataset | null {
  if (!binding) return null
  const [root] = bindingRoots(binding)
  const source =
    root && typeof scope[root] === "object"
      ? (scope[root] as Record<string, unknown>)
      : null
  const meta = {
    loading: Boolean(source?.loading),
    error: (source?.error as string | null) ?? null,
    truncated: Boolean(source?.truncated),
    source: source && Array.isArray(source.columns) ? root! : null,
    missing: Array.isArray(source?.missing)
      ? (source!.missing as string[])
      : [],
  }
  if (
    meta.source &&
    /^\{\{\s*[A-Za-z_][A-Za-z0-9_]*\.data\s*\}\}$/.test(binding.trim())
  ) {
    return {
      ...meta,
      columns: source!.columns as ResultColumn[],
      rows: source!.rows as Cell[][],
    }
  }
  const value = evaluateBinding(binding, scope)
  const list = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? [value]
      : []
  const objects = list.filter(
    (item): item is Record<string, Cell> =>
      Boolean(item) && typeof item === "object"
  )
  const names = [...new Set(objects.flatMap((o) => Object.keys(o)))]
  return {
    ...meta,
    columns: names.map((name) => ({
      name,
      kind: inferKind(objects.map((o) => o[name])),
      nativeType: "",
    })),
    rows: objects.map((o) => names.map((n) => o[n] ?? null)),
  }
}

export function columnIndex(dataset: Dataset, name: string) {
  return dataset.columns.findIndex((c) => c.name === name)
}
