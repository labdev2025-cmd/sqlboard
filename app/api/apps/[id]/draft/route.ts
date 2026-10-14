import { readJson, route } from "@/server/http"
import { saveDraft } from "@/server/services/apps"

export const PUT = route<{ id: string }>(async ({ request, user, params }) => {
  const body = (await readJson(request)) as {
    document?: unknown
    expectedUpdatedAt?: string
  }
  return Response.json(
    await saveDraft(user, params.id, body.document, body.expectedUpdatedAt)
  )
})
