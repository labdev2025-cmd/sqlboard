import { route } from "@/server/http"
import { listExecutions } from "@/server/services/audit"

export const GET = route(
  async ({ request }) => {
    const search = new URL(request.url).searchParams
    return Response.json(
      await listExecutions({
        status: search.get("status") || undefined,
        source: search.get("source") || undefined,
        userId: search.get("userId") || undefined,
        page: Number(search.get("page") ?? 1),
        pageSize: Number(search.get("pageSize") ?? 50),
      })
    )
  },
  { roles: ["admin"], allowToken: false }
)
