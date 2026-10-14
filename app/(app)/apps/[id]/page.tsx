import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AppViewer } from "@/features/app-runtime/app-viewer"
import { requireUser } from "@/server/auth/session"
import { HttpError } from "@/server/http"
import { getRunnableDocument } from "@/server/services/apps"

export const metadata: Metadata = { title: "Tela" }

export default async function ViewAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser()
  const { id } = await params
  const search = await searchParams
  const wantsDraft = search.mode === "draft"
  let loaded
  try {
    loaded = await getRunnableDocument(
      user,
      id,
      wantsDraft ? "draft" : "published"
    )
  } catch (error) {
    // Editors opening an unpublished screen see the draft preview instead.
    if (!wantsDraft && error instanceof HttpError && error.status === 404) {
      loaded = await getRunnableDocument(user, id, "draft").catch(() => null)
      if (loaded) {
        return (
          <AppViewer
            appId={id}
            document={loaded.document}
            mode="draft"
            canEdit
            initialSearch={search}
          />
        )
      }
    }
    if (error instanceof HttpError) notFound()
    throw error
  }
  return (
    <AppViewer
      appId={id}
      document={loaded.document}
      mode={wantsDraft ? "draft" : "published"}
      canEdit={loaded.permission === "edit"}
      initialSearch={search}
    />
  )
}
