import type { Metadata } from "next"

import { PageBody, PageHeader } from "@/components/app-shell/page-header"
import { AppsLibrary } from "@/features/apps/apps-library"
import { canEdit } from "@/lib/auth/roles"
import { requireUser } from "@/server/auth/session"

export const metadata: Metadata = { title: "Telas" }

export default async function AppsPage() {
  const user = await requireUser()
  return (
    <>
      <PageHeader
        title="Telas"
        description="Painéis e ferramentas montados a partir de queries."
      />
      <PageBody>
        <AppsLibrary canCreate={canEdit(user.role)} />
      </PageBody>
    </>
  )
}
