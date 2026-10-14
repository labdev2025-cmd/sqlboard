import { route } from "@/server/http"
import { documentForBrowser, getRunnableDocument } from "@/server/services/apps"

/** Document to render in view mode (published by default; draft for editors). */
export const GET = route<{ id: string }>(async ({ request, user, params }) => {
  const mode =
    new URL(request.url).searchParams.get("mode") === "draft"
      ? "draft"
      : "published"
  const { document, permission } = await getRunnableDocument(
    user,
    params.id,
    mode
  )
  return Response.json({
    document: documentForBrowser(document, permission),
    permission,
    mode,
  })
})
