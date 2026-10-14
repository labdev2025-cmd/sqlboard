import { z } from "zod"

import { ROLES } from "@/lib/auth/roles"
import { readJson, route } from "@/server/http"
import { createUserAccount, listUsers } from "@/server/services/users"

export const GET = route(async () => Response.json(await listUsers()), {
  roles: ["admin"],
})

const createSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(120),
  email: z.email("E-mail inválido."),
  password: z.string().min(8, "Mínimo de 8 caracteres.").max(200),
  role: z.enum(ROLES),
})

export const POST = route(
  async ({ request }) => {
    const input = createSchema.parse(await readJson(request))
    const created = await createUserAccount(input)
    return Response.json(created, { status: 201 })
  },
  { roles: ["admin"] }
)
