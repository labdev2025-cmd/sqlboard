"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  HistoryIcon,
  RotateCcwIcon,
  Share2Icon,
  Trash2Icon,
  UploadCloudIcon,
} from "lucide-react"

import { SimpleSelect } from "@/components/simple-select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { api, errorMessage } from "@/lib/api-client"
import { ROLE_LABELS, type Role } from "@/lib/auth/roles"

export function PublishDialog({
  appId,
  beforePublish,
  onPublished,
}: {
  appId: string
  /** Flushes pending autosave first. */
  beforePublish: () => Promise<void>
  onPublished: (version: number) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [note, setNote] = React.useState("")
  const publish = useMutation({
    mutationFn: async () => {
      await beforePublish()
      return api<{ version: number }>(`/api/apps/${appId}/publish`, {
        method: "POST",
        body: { note },
      })
    },
    onSuccess: ({ version }) => {
      toast.add({ title: `Versão ${version} publicada`, type: "success" })
      onPublished(version)
      setOpen(false)
      setNote("")
    },
  })
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) publish.reset()
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <UploadCloudIcon data-icon="inline-start" />
        Publicar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publicar tela</DialogTitle>
          <DialogDescription>
            Cria uma versão imutável do rascunho atual. Quem tem acesso de
            leitura passa a ver esta versão; o rascunho continua editável.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          {publish.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(publish.error)}</AlertDescription>
            </Alert>
          ) : null}
          <Field>
            <FieldLabel htmlFor="publish-note">
              Nota da versão (opcional)
            </FieldLabel>
            <Input
              id="publish-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="O que mudou"
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button onClick={() => publish.mutate()} disabled={publish.isPending}>
            {publish.isPending ? <Spinner data-icon="inline-start" /> : null}
            Publicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type VersionRow = {
  id: string
  version: number
  note: string
  createdAt: string
  createdByName: string | null
  published: boolean
}

export function VersionsPanel({
  appId,
  onRestored,
}: {
  appId: string
  onRestored: () => void
}) {
  const queryClient = useQueryClient()
  const versions = useQuery({
    queryKey: ["app-versions", appId],
    queryFn: () => api<VersionRow[]>(`/api/apps/${appId}/versions`),
  })
  const restore = useMutation({
    mutationFn: (version: number) =>
      api(`/api/apps/${appId}/versions/${version}/restore`, { method: "POST" }),
    onSuccess: (_, version) => {
      toast.add({
        title: `Versão ${version} restaurada no rascunho`,
        type: "success",
      })
      void queryClient.invalidateQueries({ queryKey: ["app-versions", appId] })
      onRestored()
    },
    onError: (error) =>
      toast.add({
        title: "Erro",
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
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Versões publicadas</SheetTitle>
          <SheetDescription>
            Restaurar copia a versão para o rascunho; publique de novo para
            valer.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 overflow-y-auto px-4 pb-4">
          {versions.isPending ? (
            <Skeleton className="h-20 w-full" />
          ) : versions.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {errorMessage(versions.error)}
              </AlertDescription>
            </Alert>
          ) : versions.data.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma versão publicada ainda.
            </p>
          ) : (
            versions.data.map((v) => (
              <Item key={v.id} variant="outline" size="sm">
                <ItemContent>
                  <ItemTitle>
                    v{v.version}
                    {v.published ? (
                      <Badge variant="success">publicada</Badge>
                    ) : null}
                  </ItemTitle>
                  <ItemDescription>
                    {new Date(v.createdAt).toLocaleString("pt-BR")}
                    {v.createdByName ? ` · ${v.createdByName}` : ""}
                    {v.note ? ` · ${v.note}` : ""}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restore.mutate(v.version)}
                    disabled={restore.isPending}
                  >
                    <RotateCcwIcon data-icon="inline-start" />
                    Restaurar
                  </Button>
                </ItemActions>
              </Item>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

type Person = { id: string; name: string; email: string; role: Role }
type Share = { userId: string; permission: "view" | "edit" }

export function ShareDialog({
  appId,
  ownerId,
}: {
  appId: string
  ownerId: string
}) {
  const [open, setOpen] = React.useState(false)
  const queryClient = useQueryClient()
  const people = useQuery({
    queryKey: ["users"],
    queryFn: () => api<Person[]>("/api/users"),
    enabled: open,
  })
  const current = useQuery({
    queryKey: ["app-shares", appId],
    queryFn: () =>
      api<(Share & { name: string })[]>(`/api/apps/${appId}/shares`),
    enabled: open,
  })
  const [shares, setShares] = React.useState<Share[] | null>(null)
  const list =
    shares ??
    current.data?.map(({ userId, permission }) => ({ userId, permission })) ??
    []
  const [adding, setAdding] = React.useState<string | null>(null)
  const save = useMutation({
    mutationFn: () =>
      api(`/api/apps/${appId}/shares`, {
        method: "PUT",
        body: { shares: list },
      }),
    onSuccess: () => {
      toast.add({ title: "Compartilhamento salvo", type: "success" })
      void queryClient.invalidateQueries({ queryKey: ["app-shares", appId] })
      setShares(null)
      setOpen(false)
    },
    onError: (error) =>
      toast.add({
        title: "Erro",
        description: errorMessage(error),
        type: "error",
      }),
  })
  const byId = new Map((people.data ?? []).map((p) => [p.id, p]))
  const candidates = (people.data ?? []).filter(
    (p) => p.id !== ownerId && !list.some((s) => s.userId === p.id)
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setShares(null)
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Share2Icon data-icon="inline-start" />
        Compartilhar
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartilhar tela</DialogTitle>
          <DialogDescription>
            “Ver” mostra a versão publicada. “Editar” vale para editores e
            permite mudar o rascunho.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-end gap-2">
          <Field className="min-w-0 flex-1">
            <FieldLabel htmlFor="share-add">Adicionar pessoa</FieldLabel>
            <SimpleSelect
              id="share-add"
              items={candidates.map((p) => ({
                value: p.id,
                label: `${p.name} (${ROLE_LABELS[p.role]})`,
              }))}
              value={adding}
              onValueChange={setAdding}
              placeholder="Escolha"
            />
          </Field>
          <Button
            variant="outline"
            disabled={!adding}
            onClick={() => {
              setShares([...list, { userId: adding!, permission: "view" }])
              setAdding(null)
            }}
          >
            Adicionar
          </Button>
        </div>
        {current.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <ul className="flex flex-col gap-2">
            {list.length === 0 ? (
              <li className="text-sm text-muted-foreground">
                Ainda não compartilhada.
              </li>
            ) : (
              list.map((share) => {
                const person = byId.get(share.userId)
                return (
                  <li key={share.userId}>
                    <Item variant="outline" size="sm">
                      <ItemContent>
                        <ItemTitle>{person?.name ?? share.userId}</ItemTitle>
                        <ItemDescription>
                          {person
                            ? `${person.email} · ${ROLE_LABELS[person.role]}`
                            : ""}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <SimpleSelect
                          aria-label={`Permissão de ${person?.name ?? share.userId}`}
                          size="sm"
                          className="w-28"
                          items={[
                            { value: "view", label: "Ver" },
                            ...(person?.role === "viewer"
                              ? []
                              : [{ value: "edit" as const, label: "Editar" }]),
                          ]}
                          value={share.permission}
                          onValueChange={(permission) =>
                            setShares(
                              list.map((s) =>
                                s.userId === share.userId
                                  ? { ...s, permission }
                                  : s
                              )
                            )
                          }
                        />
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Remover ${person?.name ?? ""}`}
                          onClick={() =>
                            setShares(
                              list.filter((s) => s.userId !== share.userId)
                            )
                          }
                        >
                          <Trash2Icon />
                        </Button>
                      </ItemActions>
                    </Item>
                  </li>
                )
              })
            )}
          </ul>
        )}
        <FieldDescription>
          A tela precisa estar publicada para leitores a verem.
        </FieldDescription>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || shares === null}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
