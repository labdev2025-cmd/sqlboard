import { readJson, route } from "@/server/http"
import {
  deleteAction,
  getAction,
  updateAction,
} from "@/server/services/write-actions"

export const GET = route<{ id: string }>(
  async ({ user, params }) => Response.json(await getAction(user, params.id)),
  { roles: ["admin", "editor"] }
)

export const PUT = route<{ id: string }>(
  async ({ request, user, params }) =>
    Response.json(await updateAction(user, params.id, await readJson(request))),
  { roles: ["admin"] }
)

export const DELETE = route<{ id: string }>(
  async ({ user, params }) => {
    await deleteAction(user, params.id)
    return Response.json({ ok: true })
  },
  { roles: ["admin"] }
)
