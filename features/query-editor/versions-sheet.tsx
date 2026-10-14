"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { HistoryIcon, RotateCcwIcon } from "lucide-react"

import { EmptyState } from "@/components/app-shell/states"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { api, errorMessage } from "@/lib/api-client"
import type { SavedQueryVersionView } from "@/lib/queries/schema"

/** History of a saved query with "restore" (creates a new version). */
export function VersionsSheet({
  queryId,
  canRestore,
  onRestored,
}: {
  queryId: string
  canRestore: boolean
  onRestored: () => void
}) {
  const queryClient = useQueryClient()
  const versions = useQuery({
    queryKey: ["query-versions", queryId],
    queryFn: () =>
      api<SavedQueryVersionView[]>(`/api/queries/${queryId}/versions`),
  })
  const restore = useMutation({
    mutationFn: (version: number) =>
      api(`/api/queries/${queryId}/versions/${version}/restore`, {
        method: "POST",
      }),
    onSuccess: (_, version) => {
      toast.add({ title: `Versão ${version} restaurada`, type: "success" })
      void queryClient.invalidateQueries({
        queryKey: ["query-versions", queryId],
      })
      // The page re-keys the editor by version, so a refresh loads the restored SQL.
      onRestored()
    },
    onError: (error) =>
      toast.add({
        title: "Não foi possível restaurar",
        description: errorMessage(error),
        type: "error",
      }),
  })

  return (
    <Sheet>
      <SheetTrigger render={<Button size="sm" variant="outline" />}>
        <HistoryIcon data-icon="inline-start" />
        Versões
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Histórico de versões</SheetTitle>
          <SheetDescription>
            Restaurar cria uma nova versão com o conteúdo antigo.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
          {versions.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : versions.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {errorMessage(versions.error)}
              </AlertDescription>
            </Alert>
          ) : versions.data.length === 0 ? (
            <EmptyState
              icon={HistoryIcon}
              title="Nenhuma versão ainda"
              description="Salve a query para registrar a primeira versão."
            />
          ) : (
            versions.data.map((version, index) => (
              <article
                key={version.version}
                className="flex flex-col gap-2 rounded-lg border p-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant={index === 0 ? "default" : "secondary"}>
                    v{version.version}
                  </Badge>
                  <span className="text-muted-foreground">
                    {new Date(version.createdAt).toLocaleString("pt-BR")}
                    {version.createdByName ? ` · ${version.createdByName}` : ""}
                  </span>
                  {index > 0 && canRestore ? (
                    <Button
                      size="xs"
                      variant="outline"
                      className="ml-auto"
                      onClick={() => restore.mutate(version.version)}
                      disabled={restore.isPending}
                    >
                      <RotateCcwIcon data-icon="inline-start" />
                      Restaurar
                    </Button>
                  ) : null}
                </div>
                <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 font-mono text-xs whitespace-pre-wrap">
                  {version.sql}
                </pre>
              </article>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
