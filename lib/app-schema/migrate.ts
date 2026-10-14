import {
  appDocumentSchema,
  CURRENT_SCHEMA_VERSION,
  type AppDocument,
} from "./index"

/**
 * Migrations between schema versions. Each entry upgrades a raw document
 * from version N to N+1. They run in order on load (and on import), so stored
 * snapshots never need rewriting.
 */
type RawDocument = Record<string, unknown> & { schemaVersion?: unknown }
type Migration = (doc: RawDocument) => RawDocument

export const MIGRATIONS: Record<number, Migration> = {
  /**
   * v1 → v2: queries gain `paramBindings`. v1 always read each parameter from
   * the variable of the same name; v2 keeps that as the default (empty map)
   * and turns the old per-parameter `default` of list/multi parameters that
   * pointed to `{{...}}` (never valid in v1) into explicit bindings.
   */
  1: (doc) => ({
    ...doc,
    queries: ((doc.queries as Record<string, unknown>[] | undefined) ?? []).map(
      (query) => {
        const params =
          (query.params as { name: string; default?: unknown }[] | undefined) ??
          []
        const paramBindings: Record<string, string> = {}
        for (const param of params) {
          if (
            typeof param.default === "string" &&
            /^\{\{[^{}]+\}\}$/.test(param.default.trim())
          ) {
            paramBindings[param.name] = param.default.trim()
            param.default = null
          }
        }
        return { ...query, params, paramBindings }
      }
    ),
  }),
}

export class DocumentVersionError extends Error {}

/** Upgrades a raw document to the current version and validates it. */
export function migrateDocument(raw: unknown): AppDocument {
  if (!raw || typeof raw !== "object") {
    throw new DocumentVersionError("Documento de tela inválido.")
  }
  let doc = structuredClone(raw) as RawDocument
  let version = Number(doc.schemaVersion ?? 1)
  if (!Number.isInteger(version) || version < 1) {
    throw new DocumentVersionError(
      `schemaVersion inválido: ${String(doc.schemaVersion)}.`
    )
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new DocumentVersionError(
      `Documento da versão ${version}, mais nova que a suportada (${CURRENT_SCHEMA_VERSION}). Atualize o sqlboard.`
    )
  }
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version]
    if (!step)
      throw new DocumentVersionError(`Sem migração da versão ${version}.`)
    doc = step(doc)
    version += 1
    doc.schemaVersion = version
  }
  return appDocumentSchema.parse(doc)
}
