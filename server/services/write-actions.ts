import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

import { asc, eq } from "drizzle-orm"
import { z } from "zod"

import {
  actionConfirmInputSchema,
  actionRunInputSchema,
  writeActionInputSchema,
  type ActionPreview,
  type ActionResult,
  type WriteActionView,
} from "@/lib/actions/schema"
import {
  assertSingleWriteStatement,
  compileSql,
  SqlParamError,
  syncParams,
  type CompiledQuery,
  type ParamDefinition,
  type SqlDialect,
} from "@/lib/sql-params"
import type { CurrentUser } from "@/server/auth/session"
import { db } from "@/server/db/client"
import { connections, queryExecutions, writeActions } from "@/server/db/schema"
import { adapterFor } from "@/server/datasources/registry"
import { DataSourceError } from "@/server/datasources/types"
import { env } from "@/server/env"
import { sqlHash } from "@/server/execution/execute"
import { badRequest, forbidden, HttpError, notFound } from "@/server/http"

import { canUseConnection, getConnectionRow } from "./connections"

type ActionRow = typeof writeActions.$inferSelect
type ConnectionRow = typeof connections.$inferSelect

/** A preview stays valid for this long. */
const PREVIEW_TTL_MS = 10 * 60_000

declare global {
  var __sqlboardUsedPreviews: Map<string, number> | undefined
}

/**
 * Each preview confirms one run (no double submit). Kept per process: with
 * several replicas a token could be replayed once per replica within its TTL.
 */
const usedPreviews = (globalThis.__sqlboardUsedPreviews ??= new Map())

function consumePreview(token: string) {
  const now = Date.now()
  for (const [key, expires] of usedPreviews) {
    if (expires < now) usedPreviews.delete(key)
  }
  if (usedPreviews.has(token)) {
    throw badRequest("Esta prévia já foi usada. Gere uma nova prévia.")
  }
  usedPreviews.set(token, Number(token.split(".")[0]) || now + PREVIEW_TTL_MS)
}

function toView(
  row: ActionRow,
  connectionName: string,
  user: CurrentUser
): WriteActionView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    connectionId: row.connectionId,
    connectionName,
    sql: row.sql,
    params: row.params as ParamDefinition[],
    maxAffectedRows: row.maxAffectedRows,
    updatedAt: row.updatedAt.toISOString(),
    canManage: user.role === "admin",
  }
}

function assertAdmin(user: CurrentUser) {
  if (user.role !== "admin")
    throw forbidden("Só administradores cadastram ações de escrita.")
}

/** Actions on write connections the user can use (admins: all). */
export async function listActions(
  user: CurrentUser
): Promise<WriteActionView[]> {
  const rows = await db
    .select({ action: writeActions, connectionName: connections.name })
    .from(writeActions)
    .innerJoin(connections, eq(connections.id, writeActions.connectionId))
    .orderBy(asc(writeActions.name))
  const visible: WriteActionView[] = []
  for (const row of rows) {
    if (await canUseConnection(user, row.action.connectionId)) {
      visible.push(toView(row.action, row.connectionName, user))
    }
  }
  return visible
}

/** Loads an action the user may run; unknown and forbidden both answer 404. */
async function loadRunnable(user: CurrentUser, id: string) {
  if (!z.uuid().safeParse(id).success) throw notFound("Ação não encontrada.")
  const [action] = await db
    .select()
    .from(writeActions)
    .where(eq(writeActions.id, id))
  if (!action || !(await canUseConnection(user, action.connectionId))) {
    throw notFound("Ação não encontrada.")
  }
  const connection = await getConnectionRow(action.connectionId)
  if (connection.purpose !== "write") {
    throw badRequest(
      "A conexão desta ação não é de escrita. Peça a um administrador para revisá-la."
    )
  }
  return { action, connection }
}

export async function getAction(user: CurrentUser, id: string) {
  const { action, connection } = await loadRunnable(user, id)
  return toView(action, connection.name, user)
}

function validate(sqlText: string, dialect: SqlDialect) {
  try {
    assertSingleWriteStatement(sqlText, dialect)
  } catch (error) {
    if (error instanceof SqlParamError) throw badRequest(error.message)
    throw error
  }
}

async function parseInput(raw: unknown) {
  const input = writeActionInputSchema.parse(raw)
  const connection = await getConnectionRow(input.connectionId)
  if (connection.purpose !== "write") {
    throw badRequest(
      "Escolha uma conexão cadastrada com uso “Escrita controlada”."
    )
  }
  const dialect = connection.dialect as SqlDialect
  validate(input.sql, dialect)
  // Parameters always mirror the SQL (settings of known ones are kept).
  return { ...input, params: syncParams(input.sql, input.params, dialect) }
}

export async function createAction(user: CurrentUser, raw: unknown) {
  assertAdmin(user)
  const input = await parseInput(raw)
  const [row] = await db
    .insert(writeActions)
    .values({ ...input, ownerId: user.id })
    .returning()
  return getAction(user, row!.id)
}

export async function updateAction(
  user: CurrentUser,
  id: string,
  raw: unknown
) {
  assertAdmin(user)
  await loadRunnable(user, id).catch((error) => {
    // A connection switched back to "read" must still be fixable.
    if (error instanceof HttpError && error.status === 400) return
    throw error
  })
  const input = await parseInput(raw)
  await db
    .update(writeActions)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(writeActions.id, id))
  return getAction(user, id)
}

export async function deleteAction(user: CurrentUser, id: string) {
  assertAdmin(user)
  if (!z.uuid().safeParse(id).success) throw notFound("Ação não encontrada.")
  const deleted = await db
    .delete(writeActions)
    .where(eq(writeActions.id, id))
    .returning({ id: writeActions.id })
  if (!deleted.length) throw notFound("Ação não encontrada.")
}

function compile(action: ActionRow, connection: ConnectionRow, raw: unknown) {
  const { values } = actionRunInputSchema.parse(raw)
  const dialect = connection.dialect as SqlDialect
  try {
    // Re-validated on every run: the stored SQL is the one that executes.
    assertSingleWriteStatement(action.sql, dialect)
    return compileSql(action.sql, values, {
      dialect,
      params: action.params as ParamDefinition[],
    })
  } catch (error) {
    if (error instanceof SqlParamError) throw badRequest(error.message)
    throw error
  }
}

/**
 * Binds the preview to the user, the action version and the exact values,
 * so a confirmation can only run what was reviewed.
 */
function previewSignature(
  user: CurrentUser,
  action: ActionRow,
  compiled: CompiledQuery,
  expiresAt: number
) {
  return createHmac("sha256", env.authSecret)
    .update(
      JSON.stringify([
        "write-action-preview",
        user.id,
        action.id,
        action.updatedAt.getTime(),
        compiled.sql,
        compiled.values,
        expiresAt,
      ])
    )
    .digest("base64url")
}

function checkToken(
  token: string,
  user: CurrentUser,
  action: ActionRow,
  compiled: CompiledQuery
) {
  const [expires, signature] = token.split(".")
  const expiresAt = Number(expires)
  if (!signature || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    throw badRequest("A prévia expirou. Gere uma nova prévia antes de gravar.")
  }
  const expected = Buffer.from(
    previewSignature(user, action, compiled, expiresAt)
  )
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    throw badRequest(
      "Os valores mudaram desde a prévia. Gere uma nova prévia antes de gravar."
    )
  }
}

async function audit(
  user: CurrentUser,
  action: ActionRow,
  compiled: CompiledQuery | null,
  entry: {
    status: string
    error?: string
    durationMs?: number
    rowCount?: number
  }
) {
  await db
    .insert(queryExecutions)
    .values({
      userId: user.id,
      connectionId: action.connectionId,
      queryName: action.name,
      source: "action",
      sqlHash: sqlHash(action.sql),
      params: compiled?.params ?? {},
      ...entry,
    })
    .catch((error) => console.error("[audit]", error))
}

function toHttp(error: unknown): never {
  if (error instanceof DataSourceError) {
    throw new HttpError(
      error.code === "forbidden" ? 422 : error.code === "timeout" ? 504 : 400,
      error.message
    )
  }
  throw error
}

/** Runs the statement inside a transaction and rolls it back. */
export async function previewAction(
  user: CurrentUser,
  id: string,
  raw: unknown
): Promise<ActionPreview> {
  const { action, connection } = await loadRunnable(user, id)
  const compiled = compile(action, connection, raw)
  try {
    const result = await adapterFor(connection).executeWrite(compiled, {
      timeoutMs: connection.statementTimeoutMs,
      maxAffectedRows: action.maxAffectedRows,
      commit: false,
    })
    const expiresAt = Date.now() + PREVIEW_TTL_MS
    return {
      sql: compiled.sql,
      values: Object.entries(compiled.params).map(([name, value]) => ({
        name,
        value,
      })),
      affectedRows: result.affectedRows,
      previewToken: `${expiresAt}.${previewSignature(user, action, compiled, expiresAt)}`,
      expiresAt: new Date(expiresAt).toISOString(),
    }
  } catch (error) {
    await audit(user, action, compiled, {
      status: "error",
      error: (error as Error).message,
    })
    toHttp(error)
  }
}

/** Commits the reviewed statement (same values as the preview). */
export async function runAction(
  user: CurrentUser,
  id: string,
  raw: unknown
): Promise<ActionResult> {
  const { action, connection } = await loadRunnable(user, id)
  const input = actionConfirmInputSchema.parse(raw)
  const compiled = compile(action, connection, input)
  checkToken(input.previewToken, user, action, compiled)
  consumePreview(input.previewToken)
  try {
    const result = await adapterFor(connection).executeWrite(compiled, {
      timeoutMs: connection.statementTimeoutMs,
      maxAffectedRows: action.maxAffectedRows,
      commit: true,
    })
    await audit(user, action, compiled, {
      status: "ok",
      durationMs: result.durationMs,
      rowCount: result.affectedRows,
    })
    return { affectedRows: result.affectedRows, durationMs: result.durationMs }
  } catch (error) {
    await audit(user, action, compiled, {
      status: "error",
      error: (error as Error).message,
    })
    toHttp(error)
  }
}
