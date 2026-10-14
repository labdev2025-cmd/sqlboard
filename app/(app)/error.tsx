"use client"

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react"

import { EmptyState } from "@/components/app-shell/states"
import { Button } from "@/components/ui/button"

/** Unexpected server or render error inside the app shell. */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <EmptyState
        icon={TriangleAlertIcon}
        title="Algo deu errado"
        description={
          error.digest
            ? `Tente de novo. Se continuar, informe ao administrador o código ${error.digest}.`
            : "Tente de novo. Se continuar, fale com um administrador."
        }
      >
        <Button onClick={() => retry()}>
          <RotateCcwIcon data-icon="inline-start" />
          Tentar de novo
        </Button>
      </EmptyState>
    </div>
  )
}
