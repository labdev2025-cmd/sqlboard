import { readJson, route } from "@/server/http"
import { importAppFile } from "@/server/services/app-transfer"

export const POST = route(
  async ({ request, user }) => {
    const result = await importAppFile(user, await readJson(request))
    return Response.json(result, { status: result.created ? 201 : 200 })
  },
  { roles: ["admin", "editor"] }
)
