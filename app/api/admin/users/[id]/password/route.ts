import { z } from "zod"

import { readJson, route } from "@/server/http"
import { resetUserPassword } from "@/server/services/users"

const schema = z.object({ password: z.string().min(8).max(200) })

export const POST = route<{ id: string }>(
  async ({ request, params }) => {
    const { password } = schema.parse(await readJson(request))
    await resetUserPassword(params.id, password)
    return Response.json({ ok: true })
  },
  { roles: ["admin"], allowToken: false }
)
