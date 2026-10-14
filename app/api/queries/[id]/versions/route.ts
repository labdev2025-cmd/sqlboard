import { route } from "@/server/http"
import { listVersions } from "@/server/services/queries"

export const GET = route<{ id: string }>(
  async ({ user, params }) =>
    Response.json(await listVersions(user, params.id)),
  { roles: ["admin", "editor"] }
)
