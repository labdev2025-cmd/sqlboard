import { readJson, route } from "@/server/http"
import { runAction } from "@/server/services/write-actions"

export const POST = route<{ id: string }>(
  async ({ request, user, params }) =>
    Response.json(await runAction(user, params.id, await readJson(request))),
  { roles: ["admin", "editor"] }
)
