import type { Metadata } from "next"

import { PageHeader } from "@/components/app-shell/page-header"
import { ForbiddenState } from "@/components/app-shell/states"
import { QueryEditor } from "@/features/query-editor/query-editor"
import { requireUser } from "@/server/auth/session"
import { listConnections } from "@/server/services/connections"

export const metadata: Metadata = { title: "Nova query" }

export default async function NewQueryPage() {
  const user = await requireUser()
  if (user.role === "viewer") {
    return (
      <>
        <PageHeader title="Nova query" />
        <ForbiddenState />
      </>
    )
  }
  return <QueryEditor connections={await listConnections(user, "read")} />
}
