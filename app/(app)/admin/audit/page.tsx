import type { Metadata } from "next"

import { PageBody, PageHeader } from "@/components/app-shell/page-header"
import { ForbiddenState } from "@/components/app-shell/states"
import { AuditLog } from "@/features/admin/audit-log"
import { requireUser } from "@/server/auth/session"

export const metadata: Metadata = { title: "Auditoria" }

export default async function AuditPage() {
  const user = await requireUser()
  if (user.role !== "admin") {
    return (
      <>
        <PageHeader title="Auditoria" />
        <ForbiddenState />
      </>
    )
  }
  return (
    <>
      <PageHeader
        title="Auditoria"
        description="Quem executou o quê, quando e com qual resultado."
      />
      <PageBody>
        <AuditLog />
      </PageBody>
    </>
  )
}
