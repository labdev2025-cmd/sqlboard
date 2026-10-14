import { readJson, route } from "@/server/http"
import { createSchedule, listSchedules } from "@/server/services/schedules"

const roles = { roles: ["admin", "editor"] as ("admin" | "editor")[] }

export const GET = route(
  async ({ user }) => Response.json(await listSchedules(user)),
  roles
)

export const POST = route(
  async ({ request, user }) =>
    Response.json(await createSchedule(user, await readJson(request)), {
      status: 201,
    }),
  { ...roles, allowToken: false }
)
