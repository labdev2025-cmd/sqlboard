import type { Metadata } from "next"
import { FileCode2Icon } from "lucide-react"

import { PageBody, PageHeader } from "@/components/app-shell/page-header"
import { EmptyState } from "@/components/app-shell/states"
import { requireUser } from "@/server/auth/session"

export const metadata: Metadata = { title: "Queries" }

export default async function Page() {
  await requireUser()
  return (
    <>
      <PageHeader title="Queries" />
      <PageBody>
        <EmptyState
          icon={FileCode2Icon}
          title="Nenhuma query ainda"
          description="Escreva SQL e os parâmetros viram campos."
        />
      </PageBody>
    </>
  )
}
