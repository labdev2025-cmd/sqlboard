import { readJson, route } from "@/server/http"
import { createApp, listApps } from "@/server/services/apps"

export const GET = route(async ({ request, user }) => {
  const search = new URL(request.url).searchParams
  const scope = search.get("scope")
  return Response.json(
    await listApps(user, {
      q: search.get("q") ?? undefined,
      tag: search.get("tag") ?? undefined,
      scope: scope === "mine" || scope === "shared" ? scope : "all",
    })
  )
})

export const POST = route(
  async ({ request, user }) =>
    Response.json(await createApp(user, (await readJson(request)) as never), {
      status: 201,
    }),
  { roles: ["admin", "editor"] }
)
