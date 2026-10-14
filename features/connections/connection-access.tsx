"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { api, errorMessage } from "@/lib/api-client"
import { ROLE_LABELS, type Role } from "@/lib/auth/roles"

type Person = { id: string; name: string; email: string; role: Role }

/** Admin picks which editors may use the connection (admins always can). */
export function ConnectionAccess({ connectionId }: { connectionId: string }) {
  const queryClient = useQueryClient()
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api<Person[]>("/api/users"),
  })
  const access = useQuery({
    queryKey: ["connection-access", connectionId],
    queryFn: () => api<Person[]>(`/api/connections/${connectionId}/access`),
  })
  const [selected, setSelected] = React.useState<Set<string> | null>(null)
  const current = selected ?? new Set((access.data ?? []).map((p) => p.id))
  const save = useMutation({
    mutationFn: () =>
      api(`/api/connections/${connectionId}/access`, {
        method: "PUT",
        body: { userIds: [...current] },
      }),
    onSuccess: () => {
      toast.add({ title: "Permissões salvas", type: "success" })
      void queryClient.invalidateQueries({
        queryKey: ["connection-access", connectionId],
      })
      setSelected(null)
    },
    onError: (error) =>
      toast.add({
        title: "Não foi possível salvar",
        description: errorMessage(error),
        type: "error",
      }),
  })

  if (users.isPending || access.isPending)
    return <Skeleton className="h-40 w-full max-w-xl" />
  if (users.isError || access.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {errorMessage(users.error ?? access.error)}
        </AlertDescription>
      </Alert>
    )
  }
  const editors = users.data.filter((u) => u.role !== "admin")

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <FieldSet>
        <FieldLegend>Quem pode usar esta conexão</FieldLegend>
        <FieldDescription>
          Administradores sempre podem. Editores marcados escrevem queries e
          telas com ela. Leitores só usam telas publicadas compartilhadas com
          eles.
        </FieldDescription>
        <FieldGroup className="gap-3">
          {editors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum editor cadastrado.
            </p>
          ) : (
            editors.map((person) => (
              <Field key={person.id} orientation="horizontal">
                <Checkbox
                  id={`access-${person.id}`}
                  checked={current.has(person.id)}
                  disabled={person.role === "viewer"}
                  onCheckedChange={(checked) => {
                    const next = new Set(current)
                    if (checked) next.add(person.id)
                    else next.delete(person.id)
                    setSelected(next)
                  }}
                />
                <FieldLabel
                  htmlFor={`access-${person.id}`}
                  className="font-normal"
                >
                  {person.name}{" "}
                  <span className="text-muted-foreground">
                    · {ROLE_LABELS[person.role]} · {person.email}
                  </span>
                </FieldLabel>
              </Field>
            ))
          )}
        </FieldGroup>
      </FieldSet>
      <div>
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending || selected === null}
        >
          {save.isPending ? <Spinner data-icon="inline-start" /> : null}
          Salvar permissões
        </Button>
      </div>
    </div>
  )
}
