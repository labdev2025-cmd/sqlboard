import { executeInputSchema } from "@/lib/queries/execute-schema"
import { explainQuery } from "@/server/execution/execute"
import { readJson, route } from "@/server/http"
import { getUsableConnection } from "@/server/services/connections"

export const POST = route(
  async ({ request, user }) => {
    const input = executeInputSchema.parse(await readJson(request))
    const connection = await getUsableConnection(user, input.connectionId)
    return Response.json(
      await explainQuery({
        user,
        connection,
        sql: input.sql,
        params: input.params,
        values: input.values,
        source: "explain",
      })
    )
  },
  { roles: ["admin", "editor"] }
)
