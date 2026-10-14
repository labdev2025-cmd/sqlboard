import { route } from "@/server/http"
import { duplicateApp } from "@/server/services/apps"

export const POST = route<{ id: string }>(
  async ({ user, params }) =>
    Response.json(await duplicateApp(user, params.id), { status: 201 }),
  { roles: ["admin", "editor"] }
)
