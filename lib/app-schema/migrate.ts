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

export const MIGRATIONS: Record<number, Migration> = {}

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
