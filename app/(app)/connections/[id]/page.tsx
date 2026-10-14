import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PageBody, PageHeader } from "@/components/app-shell/page-header"
import { ForbiddenState } from "@/components/app-shell/states"
import { ConnectionDetail } from "@/features/connections/connection-detail"
import { requireUser } from "@/server/auth/session"
import { HttpError } from "@/server/http"
import { getUsableConnection, toView } from "@/server/services/connections"

export const metadata: Metadata = { title: "Conexão" }

export default async function ConnectionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireUser()
  if (user.role === "viewer") {
    return (
      <>
        <PageHeader title="Conexão" />
        <ForbiddenState />
      </>
    )
  }
  const { id } = await params
  const row = await getUsableConnection(user, id).catch((error) => {
    if (error instanceof HttpError) notFound()
    throw error
  })
  const connection = toView(row)
  return (
    <>
      <PageHeader
        title={connection.name}
        description={connection.description || undefined}
      />
      <PageBody>
        <ConnectionDetail
          connection={connection}
          isAdmin={user.role === "admin"}
        />
      </PageBody>
    </>
  )
}
