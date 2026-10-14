import "server-only"

import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql as dsql,
  type SQL,
} from "drizzle-orm"

import {
  savedQueryInputSchema,
  type SavedQueryInput,
  type SavedQueryVersionView,
  type SavedQueryView,
} from "@/lib/queries/schema"
import {
  analyzeSql,
  SqlParamError,
  type ParamDefinition,
  type SqlDialect,
} from "@/lib/sql-params"
import type { CurrentUser } from "@/server/auth/session"
import { db } from "@/server/db/client"
import {
  connectionAccess,
  connections,
  savedQueries,
  savedQueryVersions,
  user as userTable,
} from "@/server/db/schema"
import { badRequest, forbidden, notFound } from "@/server/http"

import { getUsableConnection } from "./connections"

function assertEditor(user: CurrentUser) {
  if (user.role === "viewer")
    throw forbidden("Leitores não acessam a biblioteca de queries.")
}

function validateSql(sqlText: string, dialect: SqlDialect) {
  try {
    analyzeSql(sqlText, dialect)
  } catch (error) {
    if (error instanceof SqlParamError) throw badRequest(error.message)
    throw error
  }
}

const baseSelect = () =>
  db
    .select({
      q: savedQueries,
      connectionName: connections.name,
      ownerName: userTable.name,
    })
    .from(savedQueries)
    .innerJoin(connections, eq(connections.id, savedQueries.connectionId))
    .innerJoin(userTable, eq(userTable.id, savedQueries.ownerId))

function toView(
  row: {
    q: typeof savedQueries.$inferSelect
    connectionName: string
    ownerName: string
  },
  user: CurrentUser
): SavedQueryView {
  const q = row.q
  return {
    id: q.id,
    name: q.name,
    description: q.description,
    tags: q.tags,
    connectionId: q.connectionId,
    connectionName: row.connectionName,
    sql: q.sql,
    params: q.params as ParamDefinition[],
    version: q.version,
    cacheTtlSeconds: q.cacheTtlSeconds,
    ownerId: q.ownerId,
    ownerName: row.ownerName,
    canEdit: user.role === "admin" || q.ownerId === user.id,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  }
}

/** Queries on connections the user can use, filtered by text and tag. */
export async function listSavedQueries(
  user: CurrentUser,
  filters: { q?: string; tag?: string; mine?: boolean } = {}
): Promise<SavedQueryView[]> {
  assertEditor(user)
  const conditions: (SQL | undefined)[] = []
  if (user.role !== "admin") {
    const allowed = db
      .select({ id: connectionAccess.connectionId })
      .from(connectionAccess)
      .where(eq(connectionAccess.userId, user.id))
    conditions.push(inArray(savedQueries.connectionId, allowed))
  }
  if (filters.q?.trim()) {
    const term = `%${filters.q.trim().replace(/[%_\\]/g, (m) => `\\${m}`)}%`
    conditions.push(
      or(
        ilike(savedQueries.name, term),
        ilike(savedQueries.description, term),
        dsql`array_to_string(${savedQueries.tags}, ' ') ILIKE ${term}`
      )
    )
  }
  if (filters.tag)
    conditions.push(
      dsql`${filters.tag.toLowerCase()} = ANY(${savedQueries.tags})`
    )
  if (filters.mine) conditions.push(eq(savedQueries.ownerId, user.id))
  const rows = await baseSelect()
    .where(and(...conditions))
    .orderBy(desc(savedQueries.updatedAt))
  return rows.map((row) => toView(row, user))
}

export async function getSavedQuery(
  user: CurrentUser,
  id: string
): Promise<SavedQueryView> {
  assertEditor(user)
  const [row] = await baseSelect().where(eq(savedQueries.id, id))
  if (!row) throw notFound("Query não encontrada.")
  // Same visibility rule as the list: the connection must be usable.
  await getUsableConnection(user, row.q.connectionId).catch(() => {
    throw notFound("Query não encontrada.")
  })
  return toView(row, user)
}

async function assertCanEdit(user: CurrentUser, id: string) {
  const view = await getSavedQuery(user, id)
  if (!view.canEdit)
    throw forbidden("Só o dono ou um administrador edita esta query.")
  return view
}

export async function createSavedQuery(
  user: CurrentUser,
  raw: SavedQueryInput
) {
  assertEditor(user)
  const input = savedQueryInputSchema.parse(raw)
  const connection = await getUsableConnection(user, input.connectionId)
  validateSql(input.sql, connection.dialect as SqlDialect)
  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(savedQueries)
      .values({ ...input, ownerId: user.id, version: 1 })
      .returning({ id: savedQueries.id })
    await tx.insert(savedQueryVersions).values({
      queryId: row!.id,
      version: 1,
      sql: input.sql,
      params: input.params,
      createdBy: user.id,
    })
    return row!.id
  })
  return getSavedQuery(user, id)
}

export async function updateSavedQuery(
  user: CurrentUser,
  id: string,
  raw: SavedQueryInput
) {
  const current = await assertCanEdit(user, id)
  const input = savedQueryInputSchema.parse(raw)
  const connection = await getUsableConnection(user, input.connectionId)
  validateSql(input.sql, connection.dialect as SqlDialect)
  const changed =
    current.sql !== input.sql ||
    JSON.stringify(current.params) !== JSON.stringify(input.params)
  await db.transaction(async (tx) => {
    const version = changed ? current.version + 1 : current.version
    await tx
      .update(savedQueries)
      .set({ ...input, version, updatedAt: new Date() })
      .where(eq(savedQueries.id, id))
    if (changed) {
      await tx.insert(savedQueryVersions).values({
        queryId: id,
        version,
        sql: input.sql,
        params: input.params,
        createdBy: user.id,
      })
    }
  })
  return getSavedQuery(user, id)
}

export async function deleteSavedQuery(user: CurrentUser, id: string) {
  await assertCanEdit(user, id)
  await db.delete(savedQueries).where(eq(savedQueries.id, id))
}

export async function listVersions(
  user: CurrentUser,
  id: string
): Promise<SavedQueryVersionView[]> {
  await getSavedQuery(user, id)
  const rows = await db
    .select({ v: savedQueryVersions, createdByName: userTable.name })
    .from(savedQueryVersions)
    .leftJoin(userTable, eq(userTable.id, savedQueryVersions.createdBy))
    .where(eq(savedQueryVersions.queryId, id))
    .orderBy(desc(savedQueryVersions.version))
  return rows.map(({ v, createdByName }) => ({
    version: v.version,
    sql: v.sql,
    params: v.params as ParamDefinition[],
    createdAt: v.createdAt.toISOString(),
    createdByName,
  }))
}

/** Restoring creates a new version with the old content (history is immutable). */
export async function restoreVersion(
  user: CurrentUser,
  id: string,
  version: number
) {
  const current = await assertCanEdit(user, id)
  const [old] = await db
    .select()
    .from(savedQueryVersions)
    .where(
      and(
        eq(savedQueryVersions.queryId, id),
        eq(savedQueryVersions.version, version)
      )
    )
  if (!old) throw notFound("Versão não encontrada.")
  return updateSavedQuery(user, id, {
    name: current.name,
    description: current.description,
    tags: current.tags,
    connectionId: current.connectionId,
    cacheTtlSeconds: current.cacheTtlSeconds,
    sql: old.sql,
    params: old.params as ParamDefinition[],
  })
}

export async function listQueryTags(user: CurrentUser): Promise<string[]> {
  const queries = await listSavedQueries(user)
  return [...new Set(queries.flatMap((q) => q.tags))].sort()
}
