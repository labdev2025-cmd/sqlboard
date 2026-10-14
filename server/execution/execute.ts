import "server-only"

import { createHash } from "node:crypto"

import { eq } from "drizzle-orm"

import type { QueryResult } from "@/lib/data-types"
import {
  assertSingleReadStatement,
  compileSql,
  SqlParamError,
  type CompiledQuery,
  type ParamDefinition,
  type RawParamValues,
  type SqlDialect,
} from "@/lib/sql-params"
import type { CurrentUser } from "@/server/auth/session"
import { db } from "@/server/db/client"
import { queryExecutions, settings, type connections } from "@/server/db/schema"
import { adapterFor } from "@/server/datasources/registry"
import {
  DataSourceError,
  type ExecutionHandle,
} from "@/server/datasources/types"
import { badRequest, HttpError } from "@/server/http"

import { resultCache } from "./cache"

type ConnectionRow = typeof connections.$inferSelect

export type ExecutionSource =
  | "editor"
  | "app"
  | "export"
  | "compare"
  | "explain"
  | "schedule"
  | "mcp"
  | "options"
  | "action"

export type ExecuteRequest = {
  user: CurrentUser | null
  connection: ConnectionRow
  sql: string
  params?: ParamDefinition[]
  values?: RawParamValues
  source: ExecutionSource
  appId?: string | null
  savedQueryId?: string | null
  queryName?: string
  /** Requested row limit; capped by the connection maximum. */
  maxRows?: number
  signal?: AbortSignal
  /** Client-generated id so the UI can cancel through the API. */
  executionId?: string
  cacheTtlSeconds?: number
}

export type ExecuteResponse = QueryResult & {
  cached: boolean
  executionId: string
}

declare global {
  var __sqlboardRunning:
    Map<string, { userId: string | null; handle: ExecutionHandle }> | undefined
}

const running = (globalThis.__sqlboardRunning ??= new Map())

/** Cancels a running execution started by the same user (admins: any). */
export async function cancelExecution(user: CurrentUser, executionId: string) {
  const entry = running.get(executionId)
  if (!entry) return false
  if (entry.userId !== user.id && user.role !== "admin") return false
  await entry.handle.cancel()
  return true
}

export function sqlHash(sql: string) {
  return createHash("sha256").update(sql).digest("hex").slice(0, 32)
}

async function shouldMaskParams(): Promise<boolean> {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "audit.maskParams"))
  return row ? Boolean(row.value) : false
}

function auditParams(params: CompiledQuery["params"], mask: boolean) {
  if (!mask) return params
  return Object.fromEntries(Object.keys(params).map((key) => [key, "***"]))
}

/** Compiles user SQL for a read connection, translating errors to HTTP 400. */
export function compileReadQuery(
  sql: string,
  values: RawParamValues,
  params: ParamDefinition[] | undefined,
  dialect: SqlDialect
): CompiledQuery {
  try {
    assertSingleReadStatement(sql, dialect)
    return compileSql(sql, values, { dialect, params })
  } catch (error) {
    if (error instanceof SqlParamError) throw badRequest(error.message)
    throw error
  }
}

type AuditEntry = Partial<typeof queryExecutions.$inferInsert> & {
  status: string
}

/** Records one row of the execution audit trail for `request` (never throws). */
async function auditorFor(request: ExecuteRequest) {
  const hash = sqlHash(request.sql)
  const mask = await shouldMaskParams()
  return async (entry: AuditEntry, params: CompiledQuery["params"] = {}) => {
    await db
      .insert(queryExecutions)
      .values({
        userId: request.user?.id ?? null,
        connectionId: request.connection.id,
        appId: request.appId ?? null,
        savedQueryId: request.savedQueryId ?? null,
        queryName: request.queryName ?? "",
        source: request.source,
        sqlHash: hash,
        params: auditParams(params, mask),
        ...entry,
      })
      .catch((error) => console.error("[audit]", error))
  }
}

function assertReadConnection(connection: ExecuteRequest["connection"]) {
  if (connection.purpose !== "read") {
    throw badRequest("Esta conexão é só para ações de escrita.")
  }
}

/**
 * Runs a read query with every protection of PROMPT.md §4.2 (delegated to the
 * adapter), caps the row limit, records the audit trail and supports cancel.
 * Permission checks happen in the caller (services), before this function.
 */
export async function executeQuery(
  request: ExecuteRequest
): Promise<ExecuteResponse> {
  const { connection } = request
  assertReadConnection(connection)
  const dialect = connection.dialect as SqlDialect
  const executionId = request.executionId ?? crypto.randomUUID()
  const limit = Math.min(
    Math.max(1, request.maxRows ?? connection.defaultRowLimit),
    connection.maxRowLimit
  )
  const audit = await auditorFor(request)

  let compiled: CompiledQuery
  try {
    compiled = compileReadQuery(
      request.sql,
      request.values ?? {},
      request.params,
      dialect
    )
  } catch (error) {
    await audit({ status: "error", error: (error as Error).message })
    throw error
  }

  const cacheKey =
    request.cacheTtlSeconds && request.cacheTtlSeconds > 0
      ? resultCache.key(
          connection.id,
          connection.updatedAt.getTime(),
          compiled,
          limit
        )
      : null
  if (cacheKey) {
    const hit = resultCache.get(cacheKey)
    if (hit) {
      await audit(
        {
          status: "ok",
          durationMs: 0,
          rowCount: hit.rowCount,
          truncated: hit.truncated,
          cached: true,
        },
        compiled.params
      )
      return { ...hit, cached: true, executionId }
    }
  }

  const adapter = adapterFor(connection)
  try {
    const result = await adapter.execute(compiled, {
      maxRows: limit,
      timeoutMs: connection.statementTimeoutMs,
      signal: request.signal,
      onStart: (handle) =>
        running.set(executionId, { userId: request.user?.id ?? null, handle }),
    })
    if (cacheKey) resultCache.set(cacheKey, result, request.cacheTtlSeconds!)
    await audit(
      {
        status: "ok",
        durationMs: result.durationMs,
        rowCount: result.rowCount,
        truncated: result.truncated,
      },
      compiled.params
    )
    return { ...result, cached: false, executionId }
  } catch (error) {
    const status =
      error instanceof DataSourceError && error.code === "cancelled"
        ? "cancelled"
        : "error"
    await audit({ status, error: (error as Error).message }, compiled.params)
    if (error instanceof DataSourceError) {
      throw new HttpError(
        error.code === "cancelled" ? 499 : 400,
        error.message,
        {
          code: error.code,
        }
      )
    }
    throw error
  } finally {
    running.delete(executionId)
  }
}

/** EXPLAIN (no ANALYZE) inside the same read-only protections; audited. */
export async function explainQuery(request: ExecuteRequest) {
  assertReadConnection(request.connection)
  const dialect = request.connection.dialect as SqlDialect
  const audit = await auditorFor(request)
  let compiled: CompiledQuery
  try {
    compiled = compileReadQuery(
      request.sql,
      request.values ?? {},
      request.params,
      dialect
    )
  } catch (error) {
    await audit({ status: "error", error: (error as Error).message })
    throw error
  }
  const started = performance.now()
  try {
    const plan = await adapterFor(request.connection).explain(compiled, {
      timeoutMs: request.connection.statementTimeoutMs,
    })
    await audit(
      { status: "ok", durationMs: Math.round(performance.now() - started) },
      compiled.params
    )
    return plan
  } catch (error) {
    await audit(
      { status: "error", error: (error as Error).message },
      compiled.params
    )
    if (error instanceof DataSourceError) throw badRequest(error.message)
    throw error
  }
}
