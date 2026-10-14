import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { DatabaseZapIcon } from "lucide-react"

import { LoginForm } from "@/features/auth/login-form"
import { SetupForm } from "@/features/auth/setup-form"
import { getCurrentUser } from "@/server/auth/session"
import { hasAnyUser } from "@/server/services/users"

export const metadata: Metadata = { title: "Entrar" }

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/")
  const initialized = await hasAnyUser()

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-4 sm:p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <DatabaseZapIcon className="size-4" aria-hidden />
          </div>
          sqlboard
        </div>
        {initialized ? <LoginForm /> : <SetupForm />}
      </div>
    </main>
  )
}
