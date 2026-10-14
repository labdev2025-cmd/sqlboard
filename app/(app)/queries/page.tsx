import type { Metadata } from "next"
import Link from "next/link"
import { PlusIcon } from "lucide-react"

import { PageBody, PageHeader } from "@/components/app-shell/page-header"
import { ForbiddenState } from "@/components/app-shell/states"
import { buttonVariants } from "@/components/ui/button"
import { QueriesLibrary } from "@/features/queries/queries-library"
import { requireUser } from "@/server/auth/session"

export const metadata: Metadata = { title: "Queries" }

export default async function QueriesPage() {
  const user = await requireUser()
  if (user.role === "viewer") {
    return (
      <>
        <PageHeader title="Queries" />
        <ForbiddenState />
      </>
    )
  }
  return (
    <>
      <PageHeader
        title="Queries"
        description="Biblioteca de queries salvas da equipe."
        actions={
          <Link href="/queries/new" className={buttonVariants({ size: "sm" })}>
            <PlusIcon data-icon="inline-start" />
            Nova query
          </Link>
        }
      />
      <PageBody>
        <QueriesLibrary />
      </PageBody>
    </>
  )
}
