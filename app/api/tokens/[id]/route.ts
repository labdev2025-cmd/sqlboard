import { route } from "@/server/http"
import { revokeToken } from "@/server/services/api-tokens"

export const DELETE = route<{ id: string }>(
  async ({ user, params }) => {
    await revokeToken(user, params.id)
    return Response.json({ ok: true })
  },
  { allowToken: false }
)
