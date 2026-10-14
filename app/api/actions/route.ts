import { readJson, route } from "@/server/http"
import { createAction, listActions } from "@/server/services/write-actions"

export const GET = route(
  async ({ user }) => Response.json(await listActions(user)),
  { roles: ["admin", "editor"] }
)

export const POST = route(
  async ({ request, user }) =>
    Response.json(await createAction(user, await readJson(request)), {
      status: 201,
    }),
  { roles: ["admin"] }
)
