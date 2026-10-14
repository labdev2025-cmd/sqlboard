import type { Metadata } from "next"

import { PageBody, PageHeader } from "@/components/app-shell/page-header"
import { TokensManager } from "@/features/settings/tokens-manager"
import { requireUser } from "@/server/auth/session"
import { env } from "@/server/env"

export const metadata: Metadata = { title: "Tokens de API" }

export default async function TokensPage() {
  await requireUser()
  return (
    <>
      <PageHeader
        title="Tokens de API"
        description="Acesso de agentes (MCP) e scripts em seu nome."
      />
      <PageBody>
        <TokensManager origin={env.appUrl} />
      </PageBody>
    </>
  )
}
