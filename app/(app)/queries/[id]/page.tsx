import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/app-shell/page-header"
import { ForbiddenState } from "@/components/app-shell/states"
import { QueryEditor } from "@/features/query-editor/query-editor"
import { requireUser } from "@/server/auth/session"
import { HttpError } from "@/server/http"
import { listConnections } from "@/server/services/connections"
import { getSavedQuery } from "@/server/services/queries"

export const metadata: Metadata = { title: "Query" }

export default async function QueryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireUser()
  if (user.role === "viewer") {
    return (
      <>
        <PageHeader title="Query" />
        <ForbiddenState />
      </>
    )
  }
  const { id } = await params
  const query = await getSavedQuery(user, id).catch((error) => {
    if (error instanceof HttpError) notFound()
    throw error
  })
  return (
    <QueryEditor
      key={`${query.id}:${query.version}`}
      query={query}
      connections={await listConnections(user, "read")}
    />
  )
}
