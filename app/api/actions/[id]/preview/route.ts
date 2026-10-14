import { readJson, route } from "@/server/http"
import { previewAction } from "@/server/services/write-actions"

export const POST = route<{ id: string }>(
  async ({ request, user, params }) =>
    Response.json(
      await previewAction(user, params.id, await readJson(request))
    ),
  { roles: ["admin", "editor"], allowToken: false }
)
