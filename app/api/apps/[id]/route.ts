import { readJson, route } from "@/server/http"
import { deleteApp, getAppForEdit, updateAppMeta } from "@/server/services/apps"

export const GET = route<{ id: string }>(async ({ user, params }) =>
  Response.json(await getAppForEdit(user, params.id))
)

export const PATCH = route<{ id: string }>(
  async ({ request, user, params }) => {
    await updateAppMeta(user, params.id, await readJson(request))
    return Response.json({ ok: true })
  }
)

export const DELETE = route<{ id: string }>(
  async ({ user, params }) => {
    await deleteApp(user, params.id)
    return Response.json({ ok: true })
  },
  { allowToken: false }
)
