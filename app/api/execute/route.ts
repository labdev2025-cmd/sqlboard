import { executeInputSchema } from "@/lib/queries/execute-schema"
import { executeQuery } from "@/server/execution/execute"
import { readJson, route } from "@/server/http"
import { getAppAccess } from "@/server/services/apps"
import { getUsableConnection } from "@/server/services/connections"
import { getSavedQuery } from "@/server/services/queries"

export const POST = route(
  async ({ request, user }) => {
    const input = executeInputSchema.parse(await readJson(request))
    const connection = await getUsableConnection(user, input.connectionId)
    if (input.appId) await getAppAccess(user, input.appId, "edit")
    // The audit trail only records a saved query the user can really open
    // (and "app" only with an app the user edits).
    if (input.savedQueryId) await getSavedQuery(user, input.savedQueryId)
    const source =
      input.source === "app" && !input.appId ? "editor" : input.source
    const result = await executeQuery({
      user,
      connection,
      sql: input.sql,
      params: input.params,
      values: input.values,
      source,
      savedQueryId: input.savedQueryId ?? null,
      appId: input.appId ?? null,
      queryName: input.queryName,
      maxRows: input.maxRows,
      executionId: input.executionId,
      signal: request.signal,
    })
    return Response.json(result)
  },
  { roles: ["admin", "editor"] }
)
