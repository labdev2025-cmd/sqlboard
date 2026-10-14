import Link from "next/link"
import { SearchXIcon } from "lucide-react"

import { EmptyState } from "@/components/app-shell/states"
import { buttonVariants } from "@/components/ui/button"

export default function AppNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <EmptyState
        icon={SearchXIcon}
        title="Página não encontrada"
        description="O endereço não existe ou você não tem acesso a este item."
      >
        <Link href="/" className={buttonVariants()}>
          Voltar ao início
        </Link>
      </EmptyState>
    </div>
  )
}
