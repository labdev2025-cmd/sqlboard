import { route } from "@/server/http"
import { listAppVersions } from "@/server/services/apps"

export const GET = route<{ id: string }>(async ({ user, params }) =>
  Response.json(await listAppVersions(user, params.id))
)
