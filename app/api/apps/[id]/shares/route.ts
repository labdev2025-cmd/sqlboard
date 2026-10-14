import { readJson, route } from "@/server/http"
import { listShares, setShares } from "@/server/services/apps"

export const GET = route<{ id: string }>(async ({ user, params }) =>
  Response.json(await listShares(user, params.id))
)

export const PUT = route<{ id: string }>(async ({ request, user, params }) => {
  await setShares(user, params.id, await readJson(request))
  return Response.json({ ok: true })
})
