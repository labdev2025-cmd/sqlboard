import "server-only"

import type { SqlDialect } from "@/lib/sql-params"
import { decryptSecret, getKeyRing } from "@/server/crypto/secrets"
import type { connections } from "@/server/db/schema"

import { PostgresAdapter } from "./postgres"
import type { ConnectionConfig, DataSourceAdapter } from "./types"

type ConnectionRow = typeof connections.$inferSelect

type Factory = (config: ConnectionConfig) => DataSourceAdapter

const factories: Partial<Record<SqlDialect, Factory>> = {
  postgres: (config) => new PostgresAdapter(config),
}

/** Lets other dialect modules register themselves (F5). */
export function registerAdapter(dialect: SqlDialect, factory: Factory) {
  factories[dialect] = factory
}

declare global {
  var __sqlboardAdapters:
    Map<string, { key: string; adapter: DataSourceAdapter }> | undefined
}

const cache = (globalThis.__sqlboardAdapters ??= new Map())

export function configFromRow(
  row: ConnectionRow,
  password?: string | null
): ConnectionConfig {
  return {
    key: `${row.id}:${row.updatedAt.getTime()}`,
    dialect: row.dialect as SqlDialect,
    host: row.host,
    port: row.port,
    database: row.database,
    username: row.username,
    password:
      password !== undefined
        ? password
        : row.passwordEnc
          ? decryptSecret(row.passwordEnc, getKeyRing())
          : null,
    ssl: (row.ssl as ConnectionConfig["ssl"]) ?? "disable",
    statementTimeoutMs: row.statementTimeoutMs,
  }
}

export function createAdapter(config: ConnectionConfig): DataSourceAdapter {
  const factory = factories[config.dialect]
  if (!factory) {
    throw new Error(`Banco "${config.dialect}" ainda não suportado.`)
  }
  return factory(config)
}

/**
 * Adapter (and its pool) for a stored connection. The pool is rebuilt when the
 * connection is edited, and the old one is closed.
 */
export function adapterFor(row: ConnectionRow): DataSourceAdapter {
  const key = `${row.id}:${row.updatedAt.getTime()}`
  const cached = cache.get(row.id)
  if (cached?.key === key) return cached.adapter
  if (cached) void cached.adapter.close().catch(() => undefined)
  const adapter = createAdapter(configFromRow(row))
  cache.set(row.id, { key, adapter })
  return adapter
}

export function dropAdapter(connectionId: string) {
  const cached = cache.get(connectionId)
  if (cached) {
    cache.delete(connectionId)
    void cached.adapter.close().catch(() => undefined)
  }
}

export async function closeAllAdapters() {
  const all = [...cache.values()]
  cache.clear()
  await Promise.all(
    all.map((entry) => entry.adapter.close().catch(() => undefined))
  )
}
