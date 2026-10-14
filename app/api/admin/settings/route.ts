import { z } from "zod"

import { readJson, route } from "@/server/http"
import { getSetting, setSetting } from "@/server/services/audit"

export const GET = route(
  async () =>
    Response.json({ maskParams: await getSetting("audit.maskParams", false) }),
  { roles: ["admin"], allowToken: false }
)

const schema = z.object({ maskParams: z.boolean() })

export const PUT = route(
  async ({ request }) => {
    const input = schema.parse(await readJson(request))
    await setSetting("audit.maskParams", input.maskParams)
    return Response.json(input)
  },
  { roles: ["admin"], allowToken: false }
)
