import type { Metadata } from "next"

import { PageBody, PageHeader } from "@/components/app-shell/page-header"
import { ForbiddenState } from "@/components/app-shell/states"
import { ConnectionForm } from "@/features/connections/connection-form"
import { requireUser } from "@/server/auth/session"

export const metadata: Metadata = { title: "Nova conexão" }

export default async function NewConnectionPage() {
  const user = await requireUser()
  if (user.role !== "admin") {
    return (
      <>
        <PageHeader title="Nova conexão" />
        <ForbiddenState description="Só administradores cadastram conexões." />
      </>
    )
  }
  return (
    <>
      <PageHeader title="Nova conexão" />
      <PageBody>
        <ConnectionForm />
      </PageBody>
    </>
  )
}
