import { z } from "zod"

import { executeInputSchema } from "@/lib/queries/execute-schema"
import { executeQuery } from "@/server/execution/execute"
import {
  exportFileName,
  exportResponse,
  toCsv,
  toXlsx,
} from "@/server/execution/export"
import { readJson, route } from "@/server/http"
import { getUsableConnection } from "@/server/services/connections"

const schema = executeInputSchema.extend({
  format: z.enum(["csv", "xlsx"]).default("csv"),
  fileName: z.string().max(120).optional(),
})

/** Exports an ad-hoc editor query (same checks as running it). */
export const POST = route(
  async ({ request, user }) => {
    const input = schema.parse(await readJson(request))
    const connection = await getUsableConnection(user, input.connectionId)
    const result = await executeQuery({
      user,
      connection,
      sql: input.sql,
      params: input.params,
      values: input.values,
      source: "export",
      savedQueryId: input.savedQueryId ?? null,
      queryName: input.fileName ?? "",
      maxRows: connection.maxRowLimit,
      signal: request.signal,
    })
    const file = input.format === "csv" ? toCsv(result) : await toXlsx(result)
    return exportResponse(
      file,
      input.format,
      exportFileName(input.fileName || "query", input.format)
    )
  },
  { roles: ["admin", "editor"] }
)
