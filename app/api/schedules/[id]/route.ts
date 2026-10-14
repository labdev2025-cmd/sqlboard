import { readJson, route } from "@/server/http"
import { deleteSchedule, updateSchedule } from "@/server/services/schedules"

const roles = { roles: ["admin", "editor"] as ("admin" | "editor")[] }

export const PUT = route<{ id: string }>(
  async ({ request, user, params }) =>
    Response.json(
      await updateSchedule(user, params.id, await readJson(request))
    ),
  roles
)

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  await deleteSchedule(user, params.id)
  return Response.json({ ok: true })
}, roles)
