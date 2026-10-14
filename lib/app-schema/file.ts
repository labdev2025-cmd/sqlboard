import type { AppDocument } from "./index"

/** Envelope of an exported screen (JSON file, friendly to git diffs). */
export const APP_FILE_FORMAT = "sqlboard-app"

export type AppFile = {
  format: typeof APP_FILE_FORMAT
  exportedAt: string
  document: AppDocument
}

/**
 * JSON with object keys sorted and a trailing newline: the same document
 * always produces the same text, so versions diff cleanly in git.
 */
export function stableStringify(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort)
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.keys(v as object)
          .sort()
          .map((k) => [k, sort((v as Record<string, unknown>)[k])])
      )
    }
    return v
  }
  return `${JSON.stringify(sort(value), null, 2)}\n`
}

/** Accepts the export envelope or a bare document. */
export function documentFromFile(raw: unknown): unknown {
  if (
    raw &&
    typeof raw === "object" &&
    (raw as { format?: unknown }).format === APP_FILE_FORMAT
  ) {
    return (raw as { document?: unknown }).document
  }
  return raw
}

export type MissingConnection = { connectionId: string; queries: string[] }
