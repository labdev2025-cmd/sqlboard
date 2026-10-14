import { readJson, route } from "@/server/http"
import {
  createConnection,
  listConnections,
} from "@/server/services/connections"

export const GET = route(async ({ request, user }) => {
  const purpose = new URL(request.url).searchParams.get("purpose")
  return Response.json(
    await listConnections(
      user,
      purpose === "write" ? "write" : purpose === "read" ? "read" : undefined
    )
  )
})

export const POST = route(
  async ({ request, user }) =>
    Response.json(
      await createConnection(user, (await readJson(request)) as never),
      {
        status: 201,
      }
    ),
  { roles: ["admin"] }
)
