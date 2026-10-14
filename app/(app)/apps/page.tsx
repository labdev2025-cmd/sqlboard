import type { Metadata } from "next"
import { LayoutDashboardIcon } from "lucide-react"

import { PageBody, PageHeader } from "@/components/app-shell/page-header"
import { EmptyState } from "@/components/app-shell/states"
import { requireUser } from "@/server/auth/session"

export const metadata: Metadata = { title: "Telas" }

export default async function Page() {
  await requireUser()
  return (
    <>
      <PageHeader title="Telas" />
      <PageBody>
        <EmptyState
          icon={LayoutDashboardIcon}
          title="Nenhuma tela ainda"
          description="Monte painéis a partir das suas queries."
        />
      </PageBody>
    </>
  )
}
