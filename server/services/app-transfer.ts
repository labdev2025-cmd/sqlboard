import "server-only"

import { eq } from "drizzle-orm"
import { z } from "zod"

import {
  migrateDocument,
  DocumentVersionError,
  type AppDocument,
} from "@/lib/app-schema"
import {
  APP_FILE_FORMAT,
  documentFromFile,
  type AppFile,
  type MissingConnection,
} from "@/lib/app-schema/file"
import type { CurrentUser } from "@/server/auth/session"
import { db } from "@/server/db/client"
import { apps } from "@/server/db/schema"
import { badRequest, forbidden } from "@/server/http"

import { getRunnableDocument, saveDraft } from "./apps"
import { canUseConnection } from "./connections"

/** Names are unique per owner: "Vendas" → "Vendas (importada)", "… 2"… */
async function freeName(ownerId: string, name: string) {
  const taken = new Set(
    (
      await db
        .select({ name: apps.name })
        .from(apps)
        .where(eq(apps.ownerId, ownerId))
    ).map((r) => r.name)
  )
  if (!taken.has(name)) return name
  for (let n = 1; ; n++) {
    const candidate = `${name} (importada${n > 1 ? ` ${n}` : ""})`.slice(0, 120)
    if (!taken.has(candidate)) return candidate
  }
}

/** Exports the draft or the published version (editors of the app only). */
export async function exportAppFile(
  user: CurrentUser,
  id: string,
  mode: "draft" | "published"
): Promise<AppFile> {
  const { document, permission } = await getRunnableDocument(user, id, mode)
  // The file carries the SQL of every query: viewers never get it.
  if (permission !== "edit") throw forbidden("Só quem edita a tela exporta.")
  return {
    format: APP_FILE_FORMAT,
    exportedAt: new Date().toISOString(),
    document,
  }
}

export const importInputSchema = z.object({
  file: z.unknown(),
  /** Connection id in the file → connection id in this installation. */
  connectionMap: z.record(z.string(), z.uuid()).default({}),
  /** Replace the draft of this app instead of creating a new one. */
  targetAppId: z.uuid().optional(),
})

function parseDocument(file: unknown): AppDocument {
  try {
    return migrateDocument(documentFromFile(file))
  } catch (error) {
    if (error instanceof DocumentVersionError) throw badRequest(error.message)
    throw error
  }
}

/**
 * Imports a screen file: migrates old schema versions, remaps connections
 * and requires the importer to be able to use every connection. Unknown
 * connections come back as `details.missingConnections` so the UI can ask
 * for a mapping.
 */
export async function importAppFile(
  user: CurrentUser,
  raw: unknown
): Promise<{ id: string; created: boolean }> {
  if (user.role === "viewer") throw forbidden("Leitores não importam telas.")
  const input = importInputSchema.parse(raw)
  const document = parseDocument(input.file)
  for (const query of document.queries) {
    query.connectionId =
      input.connectionMap[query.connectionId] ?? query.connectionId
  }
  const missing = new Map<string, string[]>()
  for (const query of document.queries) {
    if (!(await canUseConnection(user, query.connectionId))) {
      missing.set(query.connectionId, [
        ...(missing.get(query.connectionId) ?? []),
        query.name,
      ])
    }
  }
  if (missing.size) {
    const missingConnections: MissingConnection[] = [...missing].map(
      ([connectionId, queries]) => ({ connectionId, queries })
    )
    throw badRequest(
      "Escolha, para cada conexão do arquivo, uma conexão desta instalação.",
      { missingConnections }
    )
  }
  if (input.targetAppId) {
    await saveDraft(user, input.targetAppId, document)
    return { id: input.targetAppId, created: false }
  }
  const id = crypto.randomUUID()
  document.app.id = id
  document.app.name = await freeName(user.id, document.app.name)
  await db.insert(apps).values({
    id,
    name: document.app.name,
    description: document.app.description,
    tags: document.app.tags,
    ownerId: user.id,
    draft: document,
  })
  return { id, created: true }
}
