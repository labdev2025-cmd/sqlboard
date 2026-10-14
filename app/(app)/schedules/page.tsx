import type { Metadata } from "next"

import { PageBody, PageHeader } from "@/components/app-shell/page-header"
import { ForbiddenState } from "@/components/app-shell/states"
import { SchedulesManager } from "@/features/schedules/schedules-manager"
import { requireUser } from "@/server/auth/session"

export const metadata: Metadata = { title: "Agendamentos" }

export default async function SchedulesPage() {
  const user = await requireUser()
  return (
    <>
      <PageHeader
        title="Agendamentos"
        description="Relatórios enviados por e-mail em intervalos regulares."
      />
      {user.role === "viewer" ? (
        <ForbiddenState />
      ) : (
        <PageBody>
          <SchedulesManager />
        </PageBody>
      )}
    </>
  )
}
