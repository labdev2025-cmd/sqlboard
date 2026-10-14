import { readJson, route } from "@/server/http"
import {
  deleteConnection,
  getUsableConnection,
  toView,
  updateConnection,
} from "@/server/services/connections"

export const GET = route<{ id: string }>(async ({ user, params }) =>
  Response.json(toView(await getUsableConnection(user, params.id)))
)

export const PUT = route<{ id: string }>(
  async ({ request, user, params }) =>
    Response.json(
      await updateConnection(
        user,
        params.id,
        (await readJson(request)) as never
      )
    ),
  { roles: ["admin"] }
)

export const DELETE = route<{ id: string }>(
  async ({ user, params }) => {
    await deleteConnection(user, params.id)
    return Response.json({ ok: true })
  },
  { roles: ["admin"] }
)
