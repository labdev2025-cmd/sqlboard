import { route } from "@/server/http"
import { listExecutions } from "@/server/services/audit"

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const GET = route(
  async ({ request }) => {
    const search = new URL(request.url).searchParams
    return Response.json(
      await listExecutions({
        status: search.get("status") || undefined,
        source: search.get("source") || undefined,
        userId: search.get("userId") || undefined,
        page: positiveInt(search.get("page"), 1),
        pageSize: positiveInt(search.get("pageSize"), 50),
      })
    )
  },
  { roles: ["admin"], allowToken: false }
)
