import { readJson, route } from "@/server/http"
import { testConnection } from "@/server/services/connections"

export const POST = route(
  async ({ request, user }) => {
    const body = (await readJson(request)) as { id?: string; connection: never }
    return Response.json(await testConnection(user, body.connection, body.id))
  },
  { roles: ["admin"] }
)
