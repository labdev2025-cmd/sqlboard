import { readJson, route } from "@/server/http"
import { publishApp, unpublishApp } from "@/server/services/apps"

export const POST = route<{ id: string }>(async ({ request, user, params }) => {
  const body = ((await readJson(request).catch(() => ({}))) ?? {}) as {
    note?: string
  }
  return Response.json(
    await publishApp(user, params.id, String(body.note ?? ""))
  )
})

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  await unpublishApp(user, params.id)
  return Response.json({ ok: true })
})
