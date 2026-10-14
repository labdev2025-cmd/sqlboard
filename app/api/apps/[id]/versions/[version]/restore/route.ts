import { route } from "@/server/http"
import { restoreAppVersion } from "@/server/services/apps"

export const POST = route<{ id: string; version: string }>(
  async ({ user, params }) => {
    await restoreAppVersion(user, params.id, Number(params.version))
    return Response.json({ ok: true })
  }
)
