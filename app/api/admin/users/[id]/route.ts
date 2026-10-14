import { z } from "zod"

import { ROLES } from "@/lib/auth/roles"
import { readJson, route } from "@/server/http"
import { updateUserAccount } from "@/server/services/users"

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(ROLES).optional(),
  disabled: z.boolean().optional(),
})

export const PATCH = route<{ id: string }>(
  async ({ request, user, params }) => {
    const changes = updateSchema.parse(await readJson(request))
    await updateUserAccount(params.id, changes, user.id)
    return Response.json({ ok: true })
  },
  { roles: ["admin"] }
)
