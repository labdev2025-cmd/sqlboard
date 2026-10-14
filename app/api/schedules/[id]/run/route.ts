import { route } from "@/server/http"
import { runScheduleNow } from "@/server/services/schedules"

export const POST = route<{ id: string }>(
  async ({ user, params }) => {
    const outcome = await runScheduleNow(user, params.id)
    // The mail location (outbox path) stays on the server.
    return Response.json({
      status: outcome.status,
      error: outcome.error ?? null,
      delivery: outcome.mail?.delivery ?? null,
    })
  },
  { roles: ["admin", "editor"] }
)
