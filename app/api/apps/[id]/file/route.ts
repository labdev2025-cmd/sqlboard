import { stableStringify } from "@/lib/app-schema/file"
import { exportFileName } from "@/server/execution/export"
import { route } from "@/server/http"
import { exportAppFile } from "@/server/services/app-transfer"

/** Downloads the screen as JSON (?version=published for the published one). */
export const GET = route<{ id: string }>(
  async ({ request, user, params }) => {
    const mode =
      new URL(request.url).searchParams.get("version") === "published"
        ? "published"
        : "draft"
    const file = await exportAppFile(user, params.id, mode)
    const name = exportFileName(file.document.app.name, "csv").replace(
      /-\d{4}-\d{2}-\d{2}\.csv$/,
      ".sqlboard.json"
    )
    return new Response(stableStringify(file), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${name}"`,
        "cache-control": "no-store",
      },
    })
  },
  { roles: ["admin", "editor"] }
)
