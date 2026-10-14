import { readJson, route } from "@/server/http"
import { createSavedQuery, listSavedQueries } from "@/server/services/queries"

export const GET = route(
  async ({ request, user }) => {
    const search = new URL(request.url).searchParams
    return Response.json(
      await listSavedQueries(user, {
        q: search.get("q") ?? undefined,
        tag: search.get("tag") ?? undefined,
        mine: search.get("mine") === "1",
      })
    )
  },
  { roles: ["admin", "editor"] }
)

export const POST = route(
  async ({ request, user }) =>
    Response.json(
      await createSavedQuery(user, (await readJson(request)) as never),
      {
        status: 201,
      }
    ),
  { roles: ["admin", "editor"] }
)
