import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

/** Unknown URL outside the app shell (no session needed). */
export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        O endereço não existe. Confira o link ou volte ao início.
      </p>
      <Link href="/" className={buttonVariants()}>
        Voltar ao início
      </Link>
    </main>
  )
}
