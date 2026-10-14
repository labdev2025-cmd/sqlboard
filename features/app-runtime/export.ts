import { postAndDownload } from "@/lib/download"
import type { RawParamValues } from "@/lib/sql-params/types"

/** Downloads a screen query exported by the server (CSV or XLSX). */
export function downloadExport(
  appId: string,
  body: {
    queryId: string
    values: RawParamValues
    mode: "draft" | "published"
    format: "csv" | "xlsx"
  }
) {
  return postAndDownload(
    `/api/apps/${appId}/export`,
    body,
    `export.${body.format}`
  )
}
