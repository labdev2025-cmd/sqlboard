import "server-only"

import { z } from "zod"

import { rawValueSchema } from "@/lib/queries/execute-schema"
import type { CurrentUser } from "@/server/auth/session"
import { executeQuery } from "@/server/execution/execute"
import { forbidden, notFound } from "@/server/http"

import { getRunnableDocument } from "./apps"
import { canUseConnection, getConnectionRow } from "./connections"

export const appRunInputSchema = z.object({
  queryId: z.string().min(1).max(64),
  values: z.record(z.string(), rawValueSchema).default({}),
  mode: z.enum(["draft", "published"]).default("published"),
  executionId: z.uuid().optional(),
})

/**
 * Runs one query of a screen. The SQL always comes from the stored document
 * (draft for editors, published version for viewers); the browser only sends
 * the query id and parameter values.
 */
export async function loadAppQuery(
  user: CurrentUser,
  appId: string,
  queryId: string,
  mode: "draft" | "published"
) {
  const { app, document } = await getRunnableDocument(user, appId, mode)
  const query = document.queries.find((q) => q.id === queryId)
  if (!query) throw notFound("Query da tela não encontrada.")
  const connection = await getConnectionRow(query.connectionId)
  if (mode === "draft" && !(await canUseConnection(user, connection.id))) {
    throw forbidden(`Você não tem acesso à conexão da query “${query.name}”.`)
  }
  return { app, document, query, connection }
}

export async function runAppQuery(
  user: CurrentUser,
  appId: string,
  raw: unknown,
  signal?: AbortSignal,
  source: "app" | "options" = "app"
) {
  const input = appRunInputSchema.parse(raw)
  const { app, query, connection } = await loadAppQuery(
    user,
    appId,
    input.queryId,
    input.mode
  )
  return executeQuery({
    user,
    connection,
    sql: query.sql,
    params: query.params,
    values: input.values,
    source,
    appId: app.id,
    queryName: query.name,
    cacheTtlSeconds: query.cacheTtlSeconds,
    executionId: input.executionId,
    signal,
  })
}
