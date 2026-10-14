import { z } from "zod"

import { readJson, route } from "@/server/http"
import { listAccess, setAccess } from "@/server/services/connections"

export const GET = route<{ id: string }>(
  async ({ user, params }) => Response.json(await listAccess(user, params.id)),
  { roles: ["admin"], allowToken: false }
)

const schema = z.object({ userIds: z.array(z.string()).max(1000) })

export const PUT = route<{ id: string }>(
  async ({ request, user, params }) => {
    const { userIds } = schema.parse(await readJson(request))
    await setAccess(user, params.id, userIds)
    return Response.json({ ok: true })
  },
  { roles: ["admin"], allowToken: false }
)
