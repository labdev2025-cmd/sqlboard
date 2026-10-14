import type { Metadata } from "next"

import { PageBody, PageHeader } from "@/components/app-shell/page-header"
import { ForbiddenState } from "@/components/app-shell/states"
import { UsersManager } from "@/features/admin/users-manager"
import { requireUser } from "@/server/auth/session"

export const metadata: Metadata = { title: "Usuários" }

export default async function UsersPage() {
  const user = await requireUser()
  if (user.role !== "admin") {
    return (
      <>
        <PageHeader title="Usuários" />
        <ForbiddenState />
      </>
    )
  }
  return (
    <>
      <PageHeader
        title="Usuários"
        description="Contas, papéis e acesso à equipe."
      />
      <PageBody>
        <UsersManager currentUserId={user.id} />
      </PageBody>
    </>
  )
}
