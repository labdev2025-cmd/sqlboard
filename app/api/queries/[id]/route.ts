import { readJson, route } from "@/server/http"
import {
  deleteSavedQuery,
  getSavedQuery,
  updateSavedQuery,
} from "@/server/services/queries"

const roles = { roles: ["admin", "editor"] as ("admin" | "editor")[] }

export const GET = route<{ id: string }>(
  async ({ user, params }) =>
    Response.json(await getSavedQuery(user, params.id)),
  roles
)

export const PUT = route<{ id: string }>(
  async ({ request, user, params }) =>
    Response.json(
      await updateSavedQuery(
        user,
        params.id,
        (await readJson(request)) as never
      )
    ),
  roles
)

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  await deleteSavedQuery(user, params.id)
  return Response.json({ ok: true })
}, roles)
