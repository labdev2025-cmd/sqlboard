import { cancelExecution } from "@/server/execution/execute"
import { route } from "@/server/http"

export const POST = route<{ id: string }>(async ({ user, params }) =>
  Response.json({ cancelled: await cancelExecution(user, params.id) })
)
