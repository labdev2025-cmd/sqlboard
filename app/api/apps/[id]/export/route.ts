import { z } from "zod"

import { executeQuery } from "@/server/execution/execute"
import {
  exportFileName,
  exportResponse,
  toCsv,
  toXlsx,
} from "@/server/execution/export"
import { readJson, route } from "@/server/http"
import { appRunInputSchema, loadAppQuery } from "@/server/services/app-run"

const schema = appRunInputSchema.extend({
  format: z.enum(["csv", "xlsx"]).default("csv"),
})

/**
 * Exports a screen query. Same permission rules as running it; the row limit
 * is the connection maximum (exports may need more than the screen shows).
 */
export const POST = route<{ id: string }>(async ({ request, user, params }) => {
  const input = schema.parse(await readJson(request))
  const { app, query, connection } = await loadAppQuery(
    user,
    params.id,
    input.queryId,
    input.mode
  )
  const result = await executeQuery({
    user,
    connection,
    sql: query.sql,
    params: query.params,
    values: input.values,
    source: "export",
    appId: app.id,
    queryName: query.name,
    maxRows: connection.maxRowLimit,
    signal: request.signal,
  })
  const file =
    input.format === "csv" ? toCsv(result) : await toXlsx(result, query.name)
  return exportResponse(
    file,
    input.format,
    exportFileName(`${app.name}-${query.name}`, input.format)
  )
})
