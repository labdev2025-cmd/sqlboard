import { readJson, route } from "@/server/http"
import { createToken, listTokens } from "@/server/services/api-tokens"

// Tokens are managed only with the browser session, never with a token.
export const GET = route(
  async ({ user }) => Response.json(await listTokens(user)),
  { allowToken: false }
)

export const POST = route(
  async ({ request, user }) =>
    Response.json(await createToken(user, await readJson(request)), {
      status: 201,
    }),
  { allowToken: false }
)
