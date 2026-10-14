import { readJson, route } from "@/server/http"
import { runAppQuery } from "@/server/services/app-run"

export const POST = route<{ id: string }>(async ({ request, user, params }) =>
  Response.json(
    await runAppQuery(user, params.id, await readJson(request), request.signal)
  )
)
