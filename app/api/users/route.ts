import { route } from "@/server/http"
import { listUsers } from "@/server/services/users"

/** Directory used by share/permission pickers (no sensitive fields). */
export const GET = route(
  async () => {
    const users = await listUsers()
    return Response.json(
      users
        .filter((u) => !u.disabled)
        .map(({ id, name, email, role }) => ({ id, name, email, role }))
    )
  },
  { roles: ["admin", "editor"] }
)
