import "server-only"

import { and, count, desc, eq, type SQL } from "drizzle-orm"

import { db } from "@/server/db/client"
import {
  apps,
  connections,
  queryExecutions,
  settings,
  user as userTable,
} from "@/server/db/schema"

export type AuditFilters = {
  status?: string
  source?: string
  userId?: string
  page?: number
  pageSize?: number
}

export async function listExecutions(filters: AuditFilters) {
  const pageSize = Math.min(Math.max(filters.pageSize ?? 50, 1), 200)
  const page = Math.max(filters.page ?? 1, 1)
  const conditions: SQL[] = []
  if (filters.status)
    conditions.push(eq(queryExecutions.status, filters.status))
  if (filters.source)
    conditions.push(eq(queryExecutions.source, filters.source))
  if (filters.userId)
    conditions.push(eq(queryExecutions.userId, filters.userId))
  const where = conditions.length ? and(...conditions) : undefined
  const [total] = await db
    .select({ value: count() })
    .from(queryExecutions)
    .where(where)
  const rows = await db
    .select({
      id: queryExecutions.id,
      createdAt: queryExecutions.createdAt,
      userName: userTable.name,
      connectionName: connections.name,
      appName: apps.name,
      queryName: queryExecutions.queryName,
      source: queryExecutions.source,
      sqlHash: queryExecutions.sqlHash,
      params: queryExecutions.params,
      status: queryExecutions.status,
      durationMs: queryExecutions.durationMs,
      rowCount: queryExecutions.rowCount,
      truncated: queryExecutions.truncated,
      cached: queryExecutions.cached,
      error: queryExecutions.error,
    })
    .from(queryExecutions)
    .leftJoin(userTable, eq(userTable.id, queryExecutions.userId))
    .leftJoin(connections, eq(connections.id, queryExecutions.connectionId))
    .leftJoin(apps, eq(apps.id, queryExecutions.appId))
    .where(where)
    .orderBy(desc(queryExecutions.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
  return { total: total?.value ?? 0, page, pageSize, rows }
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key))
  return row ? (row.value as T) : fallback
}

export async function setSetting(key: string, value: unknown) {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date() },
    })
}
