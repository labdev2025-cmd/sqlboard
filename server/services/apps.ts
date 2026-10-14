import "server-only"

import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  max,
  or,
  sql as dsql,
  type SQL,
} from "drizzle-orm"
import { z } from "zod"

import { querySnapshot } from "@/lib/app-schema/snapshot"
import {
  appDocumentSchema,
  migrateDocument,
  newDocument,
  type AppDocument,
} from "@/lib/app-schema"
import { tagsSchema } from "@/lib/queries/schema"
import type { CurrentUser } from "@/server/auth/session"
import { db } from "@/server/db/client"
import {
  apps,
  appShares,
  appVersions,
  user as userTable,
} from "@/server/db/schema"
import { badRequest, forbidden, HttpError, notFound } from "@/server/http"

import { canUseConnection } from "./connections"
import { getSavedQuery } from "./queries"

export type AppRow = typeof apps.$inferSelect
export type Permission = "edit" | "view"

export type AppListItem = {
  id: string
  name: string
  description: string
  tags: string[]
  ownerId: string
  ownerName: string
  updatedAt: string
  publishedAt: string | null
  status: "draft" | "published"
  canEdit: boolean
  shared: boolean
}

export const appMetaInputSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome.").max(120),
  description: z.string().trim().max(4000).default(""),
  tags: tagsSchema,
})

/** Resolves the caller's permission on an app (null = no access). */
export async function appPermission(
  user: CurrentUser,
  app: AppRow
): Promise<Permission | null> {
  if (user.role === "admin" || app.ownerId === user.id) return "edit"
  const [share] = await db
    .select({ permission: appShares.permission })
    .from(appShares)
    .where(and(eq(appShares.appId, app.id), eq(appShares.userId, user.id)))
  if (!share) return null
  if (share.permission === "edit" && user.role === "editor") return "edit"
  return "view"
}

async function loadApp(id: string): Promise<AppRow> {
  if (!z.uuid().safeParse(id).success) throw notFound("Tela não encontrada.")
  const [row] = await db.select().from(apps).where(eq(apps.id, id))
  if (!row) throw notFound("Tela não encontrada.")
  return row
}

/** App + permission, 404 when the user cannot see it at all. */
export async function getAppAccess(
  user: CurrentUser,
  id: string,
  need: Permission = "view"
) {
  const app = await loadApp(id)
  const permission = await appPermission(user, app)
  // Viewers only see published apps.
  const visible =
    permission === "edit" || (permission === "view" && app.publishedVersionId)
  if (!permission || !visible) throw notFound("Tela não encontrada.")
  if (need === "edit" && permission !== "edit") {
    throw forbidden("Você só pode visualizar esta tela.")
  }
  return { app, permission }
}

function escapeLike(text: string) {
  return text.replace(/[%_\\]/g, (m) => `\\${m}`)
}

export async function listApps(
  user: CurrentUser,
  filters: { q?: string; tag?: string; scope?: "all" | "mine" | "shared" } = {}
): Promise<AppListItem[]> {
  const sharedIds = db
    .select({ id: appShares.appId })
    .from(appShares)
    .where(eq(appShares.userId, user.id))
  const conditions: (SQL | undefined)[] = []
  if (user.role === "viewer") {
    conditions.push(
      inArray(apps.id, sharedIds),
      isNotNull(apps.publishedVersionId)
    )
  } else if (user.role === "editor") {
    conditions.push(or(eq(apps.ownerId, user.id), inArray(apps.id, sharedIds)))
  }
  if (filters.scope === "mine") conditions.push(eq(apps.ownerId, user.id))
  if (filters.scope === "shared") conditions.push(inArray(apps.id, sharedIds))
  if (filters.q?.trim()) {
    const term = `%${escapeLike(filters.q.trim())}%`
    conditions.push(
      or(
        ilike(apps.name, term),
        ilike(apps.description, term),
        dsql`array_to_string(${apps.tags}, ' ') ILIKE ${term}`
      )
    )
  }
  if (filters.tag)
    conditions.push(dsql`${filters.tag.toLowerCase()} = ANY(${apps.tags})`)

  const rows = await db
    .select({ app: apps, ownerName: userTable.name })
    .from(apps)
    .innerJoin(userTable, eq(userTable.id, apps.ownerId))
    .where(and(...conditions))
    .orderBy(desc(apps.updatedAt))
  const shares = await db
    .select({ appId: appShares.appId, permission: appShares.permission })
    .from(appShares)
    .where(eq(appShares.userId, user.id))
  const shareMap = new Map(shares.map((s) => [s.appId, s.permission]))
  return rows.map(({ app, ownerName }) => {
    const share = shareMap.get(app.id)
    const canEdit =
      user.role === "admin" ||
      app.ownerId === user.id ||
      (share === "edit" && user.role === "editor")
    return {
      id: app.id,
      name: app.name,
      description: app.description,
      tags: app.tags,
      ownerId: app.ownerId,
      ownerName,
      updatedAt: app.updatedAt.toISOString(),
      publishedAt: app.publishedAt?.toISOString() ?? null,
      status: app.publishedVersionId ? "published" : "draft",
      canEdit,
      shared: Boolean(share),
    }
  })
}

function assertCanCreate(user: CurrentUser) {
  if (user.role === "viewer") throw forbidden("Leitores não criam telas.")
}

export async function createApp(
  user: CurrentUser,
  raw: unknown
): Promise<{ id: string }> {
  assertCanCreate(user)
  const input = appMetaInputSchema
    .extend({ fromQueryId: z.uuid().optional() })
    .parse(raw)
  const id = crypto.randomUUID()
  const document = newDocument({
    id,
    name: input.name,
    description: input.description,
    tags: input.tags,
  })
  if (input.fromQueryId) {
    const saved = await getSavedQuery(user, input.fromQueryId)
    document.queries.push(querySnapshot(saved, []))
  }
  await db.insert(apps).values({
    id,
    name: input.name,
    description: input.description,
    tags: input.tags,
    ownerId: user.id,
    draft: document,
  })
  return { id }
}

export type AppForEdit = {
  id: string
  ownerId: string
  document: AppDocument
  permission: Permission
  updatedAt: string
  publishedVersion: number | null
  publishedAt: string | null
}

export async function getAppForEdit(
  user: CurrentUser,
  id: string
): Promise<AppForEdit> {
  const { app, permission } = await getAppAccess(user, id, "edit")
  return {
    id: app.id,
    ownerId: app.ownerId,
    document: migrateDocument(app.draft),
    permission,
    updatedAt: app.updatedAt.toISOString(),
    publishedVersion: await publishedVersionNumber(app),
    publishedAt: app.publishedAt?.toISOString() ?? null,
  }
}

async function publishedVersionNumber(app: AppRow) {
  if (!app.publishedVersionId) return null
  const [row] = await db
    .select({ version: appVersions.version })
    .from(appVersions)
    .where(eq(appVersions.id, app.publishedVersionId))
  return row?.version ?? null
}

/** Document a user may run: the draft (editors) or the published version. */
export async function getRunnableDocument(
  user: CurrentUser,
  id: string,
  mode: "draft" | "published"
): Promise<{ app: AppRow; document: AppDocument; permission: Permission }> {
  const { app, permission } = await getAppAccess(
    user,
    id,
    mode === "draft" ? "edit" : "view"
  )
  if (mode === "draft")
    return { app, document: migrateDocument(app.draft), permission }
  if (!app.publishedVersionId)
    throw notFound("Esta tela ainda não foi publicada.")
  const [version] = await db
    .select()
    .from(appVersions)
    .where(eq(appVersions.id, app.publishedVersionId))
  if (!version) throw notFound("Versão publicada não encontrada.")
  return { app, document: migrateDocument(version.document), permission }
}

/**
 * What a reader's browser receives: queries keep name, parameters and run
 * mode, but not the SQL nor the connection (the server loads both from the
 * stored document when running).
 */
export function documentForBrowser(
  document: AppDocument,
  permission: Permission
): AppDocument {
  if (permission === "edit") return document
  return {
    ...document,
    queries: document.queries.map((q) => ({ ...q, sql: "", connectionId: "" })),
  }
}

function changedQueries(before: AppDocument | null, after: AppDocument) {
  const old = new Map((before?.queries ?? []).map((q) => [q.id, q]))
  return after.queries.filter((q) => {
    const previous = old.get(q.id)
    // Any change (SQL, connection, parameters, options, bindings) counts:
    // e.g. dropping a list's allowed options widens what the query accepts.
    return !previous || JSON.stringify(previous) !== JSON.stringify(q)
  })
}

/**
 * Saves the draft. Queries that are new or changed must use connections the
 * editor can use (a shared editor may keep the owner's queries untouched).
 */
export async function saveDraft(
  user: CurrentUser,
  id: string,
  raw: unknown,
  expectedUpdatedAt?: string
) {
  const { app } = await getAppAccess(user, id, "edit")
  if (expectedUpdatedAt && app.updatedAt.toISOString() !== expectedUpdatedAt) {
    throw new HttpError(
      409,
      "A tela foi alterada em outra aba ou por outra pessoa. Recarregue para continuar."
    )
  }
  const parsed = appDocumentSchema.safeParse(raw)
  if (!parsed.success) {
    throw badRequest(
      "Documento de tela inválido.",
      parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }))
    )
  }
  const document = parsed.data
  document.app.id = app.id
  const before = safeMigrate(app.draft)
  for (const query of changedQueries(before, document)) {
    if (!(await canUseConnection(user, query.connectionId))) {
      throw forbidden(`Você não tem acesso à conexão da query “${query.name}”.`)
    }
  }
  const updatedAt = new Date()
  await db
    .update(apps)
    .set({
      draft: document,
      name: document.app.name,
      description: document.app.description,
      tags: document.app.tags,
      updatedAt,
    })
    .where(eq(apps.id, id))
  return { updatedAt: updatedAt.toISOString() }
}

function safeMigrate(raw: unknown) {
  try {
    return migrateDocument(raw)
  } catch {
    return null
  }
}

export async function updateAppMeta(
  user: CurrentUser,
  id: string,
  raw: unknown
) {
  const { app } = await getAppAccess(user, id, "edit")
  const input = appMetaInputSchema.parse(raw)
  const document = migrateDocument(app.draft)
  document.app = { ...document.app, ...input }
  await db
    .update(apps)
    .set({ ...input, draft: document, updatedAt: new Date() })
    .where(eq(apps.id, id))
}

export async function duplicateApp(user: CurrentUser, id: string) {
  assertCanCreate(user)
  const { app, permission } = await getAppAccess(user, id, "view")
  // Viewers of the app copy what they can already see (the published
  // version), never the unpublished draft.
  const { document } = await getRunnableDocument(
    user,
    id,
    permission === "edit" ? "draft" : "published"
  )
  // The copy belongs to the user: its queries must use their connections
  // (published copies would otherwise run on connections they cannot use).
  for (const query of document.queries) {
    if (!(await canUseConnection(user, query.connectionId))) {
      throw forbidden(
        `Você não tem acesso à conexão da query “${query.name}”, então não pode duplicar esta tela.`
      )
    }
  }
  const newId = crypto.randomUUID()
  let name = `${app.name} (cópia)`
  const mine = await db
    .select({ name: apps.name })
    .from(apps)
    .where(eq(apps.ownerId, user.id))
  const taken = new Set(mine.map((m) => m.name))
  for (let n = 2; taken.has(name); n++) name = `${app.name} (cópia ${n})`
  document.app = { ...document.app, id: newId, name }
  await db.insert(apps).values({
    id: newId,
    name,
    description: app.description,
    tags: app.tags,
    ownerId: user.id,
    draft: document,
  })
  return { id: newId }
}

export async function deleteApp(user: CurrentUser, id: string) {
  const app = await loadApp(id)
  if (user.role !== "admin" && app.ownerId !== user.id) {
    const permission = await appPermission(user, app)
    if (!permission) throw notFound("Tela não encontrada.")
    throw forbidden("Só o dono ou um administrador exclui a tela.")
  }
  await db.delete(apps).where(eq(apps.id, id))
}

/* --------------------------- versions (F4) --------------------------- */

export async function publishApp(user: CurrentUser, id: string, note = "") {
  const { app } = await getAppAccess(user, id, "edit")
  const document = migrateDocument(app.draft)
  if (document.pages.every((p) => p.widgets.length === 0)) {
    throw badRequest("Adicione pelo menos um componente antes de publicar.")
  }
  return db.transaction(async (tx) => {
    const [last] = await tx
      .select({ value: max(appVersions.version) })
      .from(appVersions)
      .where(eq(appVersions.appId, id))
    const version = (last?.value ?? 0) + 1
    const [row] = await tx
      .insert(appVersions)
      .values({
        appId: id,
        version,
        document,
        note: note.slice(0, 500),
        createdBy: user.id,
      })
      .returning({ id: appVersions.id })
    const publishedAt = new Date()
    await tx
      .update(apps)
      .set({ publishedVersionId: row!.id, publishedAt })
      .where(eq(apps.id, id))
    return { version, publishedAt: publishedAt.toISOString() }
  })
}

export async function unpublishApp(user: CurrentUser, id: string) {
  await getAppAccess(user, id, "edit")
  await db
    .update(apps)
    .set({ publishedVersionId: null, publishedAt: null })
    .where(eq(apps.id, id))
}

export async function listAppVersions(user: CurrentUser, id: string) {
  const { app } = await getAppAccess(user, id, "edit")
  const rows = await db
    .select({
      id: appVersions.id,
      version: appVersions.version,
      note: appVersions.note,
      createdAt: appVersions.createdAt,
      createdByName: userTable.name,
    })
    .from(appVersions)
    .leftJoin(userTable, eq(userTable.id, appVersions.createdBy))
    .where(eq(appVersions.appId, id))
    .orderBy(desc(appVersions.version))
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    published: row.id === app.publishedVersionId,
  }))
}

/** Restores a version into the draft (the published pointer does not move). */
export async function restoreAppVersion(
  user: CurrentUser,
  id: string,
  version: number
) {
  await getAppAccess(user, id, "edit")
  const [row] = await db
    .select()
    .from(appVersions)
    .where(and(eq(appVersions.appId, id), eq(appVersions.version, version)))
  if (!row) throw notFound("Versão não encontrada.")
  const document = migrateDocument(row.document)
  await db
    .update(apps)
    .set({
      draft: document,
      name: document.app.name,
      description: document.app.description,
      tags: document.app.tags,
      updatedAt: new Date(),
    })
    .where(eq(apps.id, id))
}

/* ---------------------------- sharing (F4) --------------------------- */

export async function listShares(user: CurrentUser, id: string) {
  await getAppAccess(user, id, "edit")
  return db
    .select({
      userId: appShares.userId,
      permission: appShares.permission,
      name: userTable.name,
      email: userTable.email,
      role: userTable.role,
    })
    .from(appShares)
    .innerJoin(userTable, eq(userTable.id, appShares.userId))
    .where(eq(appShares.appId, id))
}

export const sharesInputSchema = z.object({
  shares: z
    .array(
      z.object({
        userId: z.string().min(1),
        permission: z.enum(["view", "edit"]),
      })
    )
    .max(1000),
})

export async function setShares(user: CurrentUser, id: string, raw: unknown) {
  const { app } = await getAppAccess(user, id, "edit")
  const { shares } = sharesInputSchema.parse(raw)
  const unique = new Map(
    shares
      .filter((s) => s.userId !== app.ownerId)
      .map((s) => [s.userId, s.permission])
  )
  await db.transaction(async (tx) => {
    await tx.delete(appShares).where(eq(appShares.appId, id))
    if (unique.size) {
      await tx.insert(appShares).values(
        [...unique].map(([userId, permission]) => ({
          appId: id,
          userId,
          permission,
        }))
      )
    }
  })
}
