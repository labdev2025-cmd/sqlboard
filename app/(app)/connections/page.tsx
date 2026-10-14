import type { Metadata } from "next"
import Link from "next/link"
import { PlusIcon } from "lucide-react"

import { PageBody, PageHeader } from "@/components/app-shell/page-header"
import { ForbiddenState } from "@/components/app-shell/states"
import { buttonVariants } from "@/components/ui/button"
import { ConnectionsList } from "@/features/connections/connections-list"
import { requireUser } from "@/server/auth/session"

export const metadata: Metadata = { title: "Conexões" }

export default async function ConnectionsPage() {
  const user = await requireUser()
  if (user.role === "viewer") {
    return (
      <>
        <PageHeader title="Conexões" />
        <ForbiddenState />
      </>
    )
  }
  const isAdmin = user.role === "admin"
  return (
    <>
      <PageHeader
        title="Conexões"
        description="Bancos que a equipe pode consultar."
        actions={
          isAdmin ? (
            <Link
              href="/connections/new"
              className={buttonVariants({ size: "sm" })}
            >
              <PlusIcon data-icon="inline-start" />
              Nova conexão
            </Link>
          ) : null
        }
      />
      <PageBody>
        <ConnectionsList isAdmin={isAdmin} />
      </PageBody>
    </>
  )
}
