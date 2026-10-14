import type { Metadata } from "next"

import { PageBody, PageHeader } from "@/components/app-shell/page-header"
import { ForbiddenState } from "@/components/app-shell/states"
import { AiConnect } from "@/features/ai-connect/ai-connect"
import { requireUser } from "@/server/auth/session"
import { env } from "@/server/env"

export const metadata: Metadata = { title: "Conectar IA" }

export default async function AiConnectPage() {
  const user = await requireUser()
  return (
    <>
      <PageHeader
        title="Conectar IA"
        description="Deixe o Claude, o Codex, o Cursor ou outra IA criar queries e telas para você."
      />
      {user.role === "viewer" ? (
        <ForbiddenState description="Leitores só usam telas publicadas. Peça a um administrador o papel de editor para criar telas com IA." />
      ) : (
        <PageBody>
          <AiConnect origin={env.appUrl} />
        </PageBody>
      )}
    </>
  )
}
