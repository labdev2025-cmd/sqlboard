import { route } from "@/server/http"
import { restoreVersion } from "@/server/services/queries"

export const POST = route<{ id: string; version: string }>(
  async ({ user, params }) =>
    Response.json(
      await restoreVersion(user, params.id, Number(params.version))
    ),
  { roles: ["admin", "editor"] }
)
