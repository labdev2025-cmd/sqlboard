import { ApiError } from "@/lib/api-client"

/** POSTs JSON and saves the file the server answers with. */
export async function postAndDownload(
  url: string,
  body: unknown,
  fallbackName: string
) {
  const response = await fetch(url, {
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
  const match = /filename="([^"]+)"/.exec(
    response.headers.get("content-disposition") ?? ""
  )
  const href = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = href
  link.download = match?.[1] ?? fallbackName
  link.click()
  URL.revokeObjectURL(href)
}
