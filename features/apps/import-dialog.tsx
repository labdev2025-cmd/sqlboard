"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { UploadIcon } from "lucide-react"

import { PickerState } from "@/components/picker-state"
import { SimpleSelect } from "@/components/simple-select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { api, ApiError, errorMessage } from "@/lib/api-client"
import type { MissingConnection } from "@/lib/app-schema/file"
import type { ConnectionView } from "@/lib/connections/schema"

/** Imports a screen exported as JSON (also from another installation). */
export function ImportAppDialog() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [file, setFile] = React.useState<unknown>(null)
  const [readError, setReadError] = React.useState<string | null>(null)
  const [missing, setMissing] = React.useState<MissingConnection[]>([])
  const [mapping, setMapping] = React.useState<Record<string, string>>({})
  const connections = useQuery({
    queryKey: ["connections", "read"],
    queryFn: () => api<ConnectionView[]>("/api/connections?purpose=read"),
    enabled: open && missing.length > 0,
  })

  const importApp = useMutation({
    mutationFn: () =>
      api<{ id: string }>("/api/apps/import", {
        method: "POST",
        body: { file, connectionMap: mapping },
      }),
    onSuccess: ({ id }) => {
      toast.add({ title: "Tela importada", type: "success" })
      void queryClient.invalidateQueries({ queryKey: ["apps"] })
      setOpen(false)
      router.push(`/apps/${id}/edit`)
    },
    onError: (error) => {
      const details =
        error instanceof ApiError
          ? (error.details as { missingConnections?: MissingConnection[] })
          : undefined
      if (details?.missingConnections) setMissing(details.missingConnections)
    },
  })

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    setReadError(null)
    setMissing([])
    setMapping({})
    importApp.reset()
    const selected = event.target.files?.[0]
    if (!selected) return setFile(null)
    try {
      setFile(JSON.parse(await selected.text()))
    } catch {
      setFile(null)
      setReadError("O arquivo não é um JSON válido.")
    }
  }

  const unmapped = missing.some((m) => !mapping[m.connectionId])
  const showError =
    importApp.isError && !(missing.length && !Object.keys(mapping).length)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setFile(null)
          setMissing([])
          setMapping({})
          setReadError(null)
          importApp.reset()
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <UploadIcon data-icon="inline-start" />
        Importar
      </DialogTrigger>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            importApp.mutate()
          }}
        >
          <DialogHeader>
            <DialogTitle>Importar tela</DialogTitle>
            <DialogDescription>
              Arquivo .json exportado por um sqlboard. Versões antigas do
              formato são convertidas automaticamente.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {readError ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{readError}</AlertDescription>
              </Alert>
            ) : null}
            {showError ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>
                  {errorMessage(importApp.error)}
                </AlertDescription>
              </Alert>
            ) : null}
            <Field>
              <FieldLabel htmlFor="import-file">Arquivo</FieldLabel>
              <Input
                id="import-file"
                type="file"
                accept="application/json,.json"
                onChange={onFile}
              />
            </Field>
            {missing.length ? (
              <FieldSet className="gap-3">
                <FieldLegend variant="label">Conexões</FieldLegend>
                <FieldDescription>
                  O arquivo usa conexões que não existem aqui ou às quais você
                  não tem acesso. Escolha qual usar em cada caso.
                </FieldDescription>
                <PickerState
                  error={connections.error}
                  empty={connections.data?.length === 0}
                  emptyText="Você não tem acesso a nenhuma conexão. Peça acesso a um administrador."
                />
                {missing.map((m, index) => (
                  <Field key={m.connectionId}>
                    <FieldLabel htmlFor={`import-map-${index}`}>
                      Queries {m.queries.join(", ")}
                    </FieldLabel>
                    <SimpleSelect
                      id={`import-map-${index}`}
                      items={(connections.data ?? []).map((c) => ({
                        value: c.id,
                        label: c.name,
                      }))}
                      value={mapping[m.connectionId] ?? null}
                      onValueChange={(value) => {
                        importApp.reset()
                        setMapping((prev) => ({
                          ...prev,
                          [m.connectionId]: value,
                        }))
                      }}
                      disabled={connections.isPending}
                    />
                  </Field>
                ))}
              </FieldSet>
            ) : null}
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancelar
            </DialogClose>
            <Button
              type="submit"
              disabled={
                !file || importApp.isPending || (missing.length > 0 && unmapped)
              }
            >
              {importApp.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : null}
              Importar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
