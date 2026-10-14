import { executeInputSchema } from "@/lib/queries/execute-schema"
import { executeQuery } from "@/server/execution/execute"
import { readJson, route } from "@/server/http"
import { getUsableConnection } from "@/server/services/connections"

export const POST = route(
  async ({ request, user }) => {
    const input = executeInputSchema.parse(await readJson(request))
    const connection = await getUsableConnection(user, input.connectionId)
    const result = await executeQuery({
      user,
      connection,
      sql: input.sql,
      params: input.params,
      values: input.values,
      source: input.source,
      savedQueryId: input.savedQueryId ?? null,
      maxRows: input.maxRows,
      executionId: input.executionId,
      signal: request.signal,
    })
    return Response.json(result)
  },
  { roles: ["admin", "editor"] }
)
