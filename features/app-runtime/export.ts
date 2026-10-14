import { ApiError } from "@/lib/api-client"
import type { RawParamValues } from "@/lib/sql-params/types"

/** Downloads a query result exported by the server (CSV or XLSX). */
export async function downloadExport(
  appId: string,
  body: {
    queryId: string
    values: RawParamValues
    mode: "draft" | "published"
    format: "csv" | "xlsx"
  }
) {
  const response = await fetch(`/api/apps/${appId}/export`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    throw new ApiError(response.status, data?.error ?? "Falha na exportação.")
  }
  const blob = await response.blob()
  const disposition = response.headers.get("content-disposition") ?? ""
  const match = /filename="([^"]+)"/.exec(disposition)
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = match?.[1] ?? `export.${body.format}`
  link.click()
  URL.revokeObjectURL(url)
}
