import type { Metadata } from "next"

import { PageBody, PageHeader } from "@/components/app-shell/page-header"
import { ForbiddenState } from "@/components/app-shell/states"
import { ActionsManager } from "@/features/actions/actions-manager"
import { requireUser } from "@/server/auth/session"

export const metadata: Metadata = { title: "Ações de escrita" }

export default async function ActionsPage() {
  const user = await requireUser()
  return (
    <>
      <PageHeader
        title="Ações de escrita"
        description="Formulários que gravam no banco com prévia, confirmação e auditoria."
      />
      {user.role === "viewer" ? (
        <ForbiddenState />
      ) : (
        <PageBody>
          <ActionsManager isAdmin={user.role === "admin"} />
        </PageBody>
      )}
    </>
  )
}
