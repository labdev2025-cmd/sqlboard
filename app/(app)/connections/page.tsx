import type { Metadata } from "next"
import { DatabaseIcon } from "lucide-react"

import { PageBody, PageHeader } from "@/components/app-shell/page-header"
import { EmptyState } from "@/components/app-shell/states"
import { requireUser } from "@/server/auth/session"

export const metadata: Metadata = { title: "Conexões" }

export default async function Page() {
  await requireUser()
  return (
    <>
      <PageHeader title="Conexões" />
      <PageBody>
        <EmptyState
          icon={DatabaseIcon}
          title="Nenhuma conexão ainda"
          description="Cadastre um banco para a equipe consultar."
        />
      </PageBody>
    </>
  )
}
