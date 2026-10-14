import { route } from "@/server/http"
import { getSchema } from "@/server/services/connections"

export const GET = route<{ id: string }>(
  async ({ request, user, params }) => {
    const refresh = new URL(request.url).searchParams.get("refresh") === "1"
    return Response.json(await getSchema(user, params.id, refresh))
  },
  { roles: ["admin", "editor"] }
)
