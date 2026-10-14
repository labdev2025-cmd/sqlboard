import "server-only"

import { and, asc, eq, inArray } from "drizzle-orm"

import type { CurrentUser } from "@/server/auth/session"
import {
  connectionInputSchema,
  type ConnectionInput,
  type ConnectionView,
  type Dialect,
} from "@/lib/connections/schema"
import type { SchemaInfo } from "@/lib/data-types"
import { encryptSecret, getKeyRing } from "@/server/crypto/secrets"
import { db } from "@/server/db/client"
import {
  connectionAccess,
  connections,
  user as userTable,
} from "@/server/db/schema"
import {
  adapterFor,
  configFromRow,
  createAdapter,
  dropAdapter,
} from "@/server/datasources/registry"
import { DataSourceError } from "@/server/datasources/types"
import { badRequest, forbidden, notFound } from "@/server/http"

export type ConnectionRow = typeof connections.$inferSelect

export function toView(row: ConnectionRow): ConnectionView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    dialect: row.dialect as Dialect,
    host: row.host,
    port: row.port,
    database: row.database,
    username: row.username,
    hasPassword: Boolean(row.passwordEnc),
    ssl: row.ssl as ConnectionView["ssl"],
    statementTimeoutMs: row.statementTimeoutMs,
    defaultRowLimit: row.defaultRowLimit,
    maxRowLimit: row.maxRowLimit,
    purpose: row.purpose as ConnectionView["purpose"],
    isDemo: row.isDemo,
    schemaCachedAt: row.schemaCachedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Ids of connections the user may use (admins: all). */
async function accessibleIds(user: CurrentUser): Promise<string[] | "all"> {
  if (user.role === "admin") return "all"
  if (user.role !== "editor") return []
  const rows = await db
    .select({ id: connectionAccess.connectionId })
    .from(connectionAccess)
    .where(eq(connectionAccess.userId, user.id))
  return rows.map((r) => r.id)
}

export async function listConnections(
  user: CurrentUser,
  purpose?: "read" | "write"
): Promise<ConnectionView[]> {
  const ids = await accessibleIds(user)
  if (ids !== "all" && ids.length === 0) return []
  const conditions = [
    ids === "all" ? undefined : inArray(connections.id, ids),
    purpose ? eq(connections.purpose, purpose) : undefined,
  ].filter(Boolean)
  const rows = await db
    .select()
    .from(connections)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(connections.name))
  return rows.map(toView)
}

export async function canUseConnection(
  user: CurrentUser,
  connectionId: string
) {
  const ids = await accessibleIds(user)
  return ids === "all" || ids.includes(connectionId)
}

/**
 * Loads a connection the user is allowed to use. Unknown and forbidden ids
 * both answer 404 so the API does not reveal which connections exist.
 */
export async function getUsableConnection(
  user: CurrentUser,
  connectionId: string
): Promise<ConnectionRow> {
  if (!(await canUseConnection(user, connectionId))) {
    throw notFound("Conexão não encontrada.")
  }
  const [row] = await db
    .select()
    .from(connections)
    .where(eq(connections.id, connectionId))
  if (!row) throw notFound("Conexão não encontrada.")
  return row
}

export async function getConnectionRow(connectionId: string) {
  const [row] = await db
    .select()
    .from(connections)
    .where(eq(connections.id, connectionId))
  if (!row) throw notFound("Conexão não encontrada.")
  return row
}

function assertAdmin(user: CurrentUser) {
  if (user.role !== "admin")
    throw forbidden("Só administradores gerenciam conexões.")
}

function values(input: ReturnType<typeof connectionInputSchema.parse>) {
  return {
    name: input.name,
    description: input.description,
    dialect: input.dialect,
    host: input.dialect === "sqlite" ? "" : input.host,
    port: input.dialect === "sqlite" ? null : input.port,
    database: input.database,
    username: input.dialect === "sqlite" ? "" : input.username,
    ssl: input.ssl,
    statementTimeoutMs: input.statementTimeoutMs,
    defaultRowLimit: input.defaultRowLimit,
    maxRowLimit: input.maxRowLimit,
    purpose: input.purpose,
  }
}

/**
 * The stored password only goes back to the same server, user and TLS
 * setting. Otherwise an admin could point the connection at a host they
 * control and receive the plaintext password: it must be typed again.
 */
function assertStoredPasswordTarget(
  existing: ConnectionRow,
  next: ReturnType<typeof values>,
  input: ReturnType<typeof connectionInputSchema.parse>
) {
  if (!existing.passwordEnc || input.password || input.clearPassword) return
  const moved =
    existing.dialect !== next.dialect ||
    existing.host !== next.host ||
    (existing.port ?? null) !== (next.port ?? null) ||
    existing.username !== next.username ||
    existing.ssl !== next.ssl
  if (moved) {
    throw badRequest(
      "Digite a senha de novo: o servidor, a porta, o usuário ou o SSL da conexão mudou."
    )
  }
}

export async function createConnection(
  user: CurrentUser,
  raw: ConnectionInput
) {
  assertAdmin(user)
  const input = connectionInputSchema.parse(raw)
  const [row] = await db
    .insert(connections)
    .values({
      ...values(input),
      passwordEnc: input.password
        ? encryptSecret(input.password, getKeyRing())
        : null,
      createdBy: user.id,
    })
    .returning()
  return toView(row!)
}

export async function updateConnection(
  user: CurrentUser,
  id: string,
  raw: ConnectionInput
) {
  assertAdmin(user)
  const existing = await getConnectionRow(id)
  const input = connectionInputSchema.parse(raw)
  assertStoredPasswordTarget(existing, values(input), input)
  const passwordEnc = input.clearPassword
    ? null
    : input.password
      ? encryptSecret(input.password, getKeyRing())
      : existing.passwordEnc
  const [row] = await db
    .update(connections)
    .set({
      ...values(input),
      passwordEnc,
      schemaCache: null,
      schemaCachedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(connections.id, id))
    .returning()
  dropAdapter(id)
  return toView(row!)
}

export async function deleteConnection(user: CurrentUser, id: string) {
  assertAdmin(user)
  await getConnectionRow(id)
  await db.delete(connections).where(eq(connections.id, id))
  dropAdapter(id)
}

/**
 * Tests a connection. With `id`, the stored password is used unless a new one
 * is typed; without it, tests an unsaved configuration.
 */
export async function testConnection(
  user: CurrentUser,
  raw: ConnectionInput,
  id?: string
): Promise<{ ok: true; serverVersion?: string }> {
  assertAdmin(user)
  const input = connectionInputSchema.parse(raw)
  const existing = id ? await getConnectionRow(id) : null
  if (existing) assertStoredPasswordTarget(existing, values(input), input)
  const draft = {
    ...(existing ?? ({} as ConnectionRow)),
    ...values(input),
    id: id ?? "test",
    updatedAt: new Date(),
    passwordEnc: null,
  } as ConnectionRow
  const password = input.clearPassword
    ? null
    : (input.password ?? (existing ? configFromRow(existing).password : null))
  const adapter = createAdapter({
    ...configFromRow(draft, password),
    key: `test:${Date.now()}`,
  })
  try {
    await adapter.testConnection()
    return { ok: true }
  } catch (error) {
    if (error instanceof DataSourceError) throw badRequest(error.message)
    throw error
  } finally {
    await adapter.close().catch(() => undefined)
  }
}

/** Cached schema snapshot; `refresh` introspects the database again. */
export async function getSchema(
  user: CurrentUser,
  id: string,
  refresh = false
): Promise<SchemaInfo> {
  const row = await getUsableConnection(user, id)
  if (!refresh && row.schemaCache) return row.schemaCache as SchemaInfo
  let schema: SchemaInfo
  try {
    schema = await adapterFor(row).introspect()
  } catch (error) {
    if (error instanceof DataSourceError) throw badRequest(error.message)
    throw error
  }
  await db
    .update(connections)
    .set({ schemaCache: schema, schemaCachedAt: new Date() })
    .where(eq(connections.id, id))
  return schema
}

export async function listAccess(user: CurrentUser, id: string) {
  assertAdmin(user)
  await getConnectionRow(id)
  return db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      role: userTable.role,
    })
    .from(connectionAccess)
    .innerJoin(userTable, eq(userTable.id, connectionAccess.userId))
    .where(eq(connectionAccess.connectionId, id))
    .orderBy(asc(userTable.name))
}

export async function setAccess(
  user: CurrentUser,
  id: string,
  userIds: string[]
) {
  assertAdmin(user)
  await getConnectionRow(id)
  const unique = [...new Set(userIds)]
  await db.transaction(async (tx) => {
    await tx
      .delete(connectionAccess)
      .where(eq(connectionAccess.connectionId, id))
    if (unique.length) {
      await tx
        .insert(connectionAccess)
        .values(unique.map((userId) => ({ connectionId: id, userId })))
    }
  })
}
