import type { Metadata } from "next"
import { ScrollTextIcon } from "lucide-react"

import { PageBody, PageHeader } from "@/components/app-shell/page-header"
import { EmptyState } from "@/components/app-shell/states"
import { requireUser } from "@/server/auth/session"

export const metadata: Metadata = { title: "Auditoria" }

export default async function Page() {
  await requireUser()
  return (
    <>
      <PageHeader title="Auditoria" />
      <PageBody>
        <EmptyState
          icon={ScrollTextIcon}
          title="Nenhuma execução registrada"
          description="As execuções de queries aparecem aqui."
        />
      </PageBody>
    </>
  )
}
