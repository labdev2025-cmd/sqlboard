import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/app-shell/page-header"
import { ForbiddenState } from "@/components/app-shell/states"
import { Builder } from "@/features/builder/builder"
import { requireUser } from "@/server/auth/session"
import { HttpError } from "@/server/http"
import { getAppForEdit } from "@/server/services/apps"
import { listConnections } from "@/server/services/connections"

export const metadata: Metadata = { title: "Editar tela" }

export default async function EditAppPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireUser()
  const { id } = await params
  let app
  try {
    app = await getAppForEdit(user, id)
  } catch (error) {
    if (error instanceof HttpError && error.status === 403) {
      return (
        <>
          <PageHeader title="Editar tela" />
          <ForbiddenState description="Você pode visualizar esta tela, mas não editá-la." />
        </>
      )
    }
    if (error instanceof HttpError) notFound()
    throw error
  }
  return (
    <Builder
      key={`${app.id}:${app.updatedAt}`}
      app={{
        id: app.id,
        ownerId: app.ownerId,
        document: app.document,
        updatedAt: app.updatedAt,
        publishedVersion: app.publishedVersion,
      }}
      connections={await listConnections(user, "read")}
    />
  )
}
