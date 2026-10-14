"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CopyIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  LayoutDashboardIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SquarePenIcon,
  Trash2Icon,
} from "lucide-react"

import { EmptyState } from "@/components/app-shell/states"
import { SimpleSelect } from "@/components/simple-select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { TagFilter } from "@/components/tag-filter"
import { useDebounced } from "@/hooks/use-debounced"
import { api, errorMessage } from "@/lib/api-client"
import type { SavedQueryView } from "@/lib/queries/schema"

import { ImportAppDialog } from "./import-dialog"

type AppItem = {
  id: string
  name: string
  description: string
  tags: string[]
  ownerName: string
  updatedAt: string
  status: "draft" | "published"
  canEdit: boolean
  shared: boolean
}

const BLANK = "__blank__"

function AppMetaDialog({
  open,
  onOpenChange,
  app,
  canUseQueries,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  app?: AppItem
  canUseQueries: boolean
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [fromQuery, setFromQuery] = React.useState(BLANK)
  const queries = useQuery({
    queryKey: ["queries", {}],
    queryFn: () => api<SavedQueryView[]>("/api/queries"),
    enabled: open && !app && canUseQueries,
  })
  const save = useMutation({
    mutationFn: (body: {
      name: string
      description: string
      tags: string[]
    }) =>
      app
        ? api(`/api/apps/${app.id}`, { method: "PATCH", body })
        : api<{ id: string }>("/api/apps", {
            method: "POST",
            body: {
              ...body,
              fromQueryId: fromQuery === BLANK ? undefined : fromQuery,
            },
          }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["apps"] })
      onOpenChange(false)
      if (app) toast.add({ title: "Dados da tela salvos", type: "success" })
      else router.push(`/apps/${(result as { id: string }).id}/edit`)
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (next) save.reset()
      }}
    >
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            save.mutate({
              name: String(form.get("name")),
              description: String(form.get("description")),
              tags: String(form.get("tags"))
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            })
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {app ? "Editar dados da tela" : "Nova tela"}
            </DialogTitle>
            <DialogDescription>
              {app
                ? "Nome, finalidade e tags."
                : "Dê um nome e conte para que a tela serve."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {save.isError ? (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage(save.error)}</AlertDescription>
              </Alert>
            ) : null}
            <Field>
              <FieldLabel htmlFor="app-meta-name">Nome</FieldLabel>
              <Input
                id="app-meta-name"
                name="name"
                defaultValue={app?.name}
                required
                autoComplete="off"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="app-meta-description">
                Descrição / finalidade
              </FieldLabel>
              <Textarea
                id="app-meta-description"
                name="description"
                rows={3}
                defaultValue={app?.description}
                placeholder="Ex.: acompanhar as vendas por categoria para a reunião semanal do comercial."
              />
              <FieldDescription>
                Por que esta tela existe: para que serve, quem usa e de onde vêm
                os dados.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="app-meta-tags">Tags</FieldLabel>
              <Input
                id="app-meta-tags"
                name="tags"
                defaultValue={app?.tags.join(", ")}
                placeholder="vendas, semanal"
              />
              <FieldDescription>Separe por vírgula.</FieldDescription>
            </Field>
            {!app && canUseQueries ? (
              <Field>
                <FieldLabel htmlFor="app-meta-from">Começar com</FieldLabel>
                <SimpleSelect
                  id="app-meta-from"
                  items={[
                    { value: BLANK, label: "Tela em branco" },
                    ...(queries.data ?? []).map((q) => ({
                      value: q.id,
                      label: `Query: ${q.name}`,
                    })),
                  ]}
                  value={fromQuery}
                  onValueChange={setFromQuery}
                />
                <FieldDescription>
                  A query da biblioteca é copiada para dentro da tela.
                </FieldDescription>
              </Field>
            ) : null}
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Spinner data-icon="inline-start" /> : null}
              {app ? "Salvar" : "Criar tela"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AppsLibrary({ canCreate }: { canCreate: boolean }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [text, setText] = React.useState("")
  const [scope, setScope] = React.useState("all")
  const [tag, setTag] = React.useState<string | null>(null)
  const [creating, setCreating] = React.useState(false)
  const [editing, setEditing] = React.useState<AppItem | null>(null)
  const [deleting, setDeleting] = React.useState<AppItem | null>(null)
  const q = useDebounced(text)
  const params = new URLSearchParams({ scope })
  if (q) params.set("q", q)
  if (tag) params.set("tag", tag)
  const apps = useQuery({
    queryKey: ["apps", scope, q, tag],
    queryFn: () => api<AppItem[]>(`/api/apps?${params}`),
  })
  const allApps = useQuery({
    queryKey: ["apps", "all", "", null],
    queryFn: () => api<AppItem[]>("/api/apps?scope=all"),
  })
  const tags = [...new Set((allApps.data ?? []).flatMap((a) => a.tags))].sort()

  const duplicate = useMutation({
    mutationFn: (id: string) =>
      api<{ id: string }>(`/api/apps/${id}/duplicate`, { method: "POST" }),
    onSuccess: ({ id }) => {
      toast.add({ title: "Tela duplicada", type: "success" })
      void queryClient.invalidateQueries({ queryKey: ["apps"] })
      router.push(`/apps/${id}/edit`)
    },
    onError: (error) =>
      toast.add({
        title: "Erro",
        description: errorMessage(error),
        type: "error",
      }),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/apps/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.add({ title: "Tela excluída", type: "success" })
      void queryClient.invalidateQueries({ queryKey: ["apps"] })
      setDeleting(null)
    },
    onError: (error) =>
      toast.add({
        title: "Erro",
        description: errorMessage(error),
        type: "error",
      }),
  })

  const filtered = Boolean(q || tag || scope !== "all")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-full max-w-sm">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Buscar telas por nome, descrição ou tag"
            placeholder="Buscar por nome, descrição ou tag"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </InputGroup>
        <ToggleGroup
          variant="outline"
          value={[scope]}
          onValueChange={(value) => setScope((value as string[])[0] ?? "all")}
          aria-label="Filtrar telas"
        >
          <ToggleGroupItem value="all">Todas</ToggleGroupItem>
          <ToggleGroupItem value="mine">Minhas</ToggleGroupItem>
          <ToggleGroupItem value="shared" aria-label="Compartilhadas comigo">
            <span className="sm:hidden">Comigo</span>
            <span className="hidden sm:inline">Compartilhadas comigo</span>
          </ToggleGroupItem>
        </ToggleGroup>
        {canCreate ? (
          <div className="flex gap-2 sm:ml-auto">
            <ImportAppDialog />
            <Button onClick={() => setCreating(true)}>
              <PlusIcon data-icon="inline-start" />
              Nova tela
            </Button>
          </div>
        ) : null}
      </div>
      <TagFilter tags={tags} value={tag} onChange={setTag} />

      {apps.isPending ? (
        <div
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          aria-busy="true"
        >
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : apps.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(apps.error)}</AlertDescription>
        </Alert>
      ) : apps.data.length === 0 ? (
        <EmptyState
          icon={LayoutDashboardIcon}
          title={filtered ? "Nenhuma tela encontrada" : "Nenhuma tela ainda"}
          description={
            filtered
              ? "Tente outros termos ou filtros."
              : canCreate
                ? "Monte painéis e ferramentas a partir das suas queries."
                : "Quando alguém compartilhar uma tela publicada com você, ela aparece aqui."
          }
        >
          {!filtered && canCreate ? (
            <Button onClick={() => setCreating(true)}>
              <PlusIcon data-icon="inline-start" />
              Criar primeira tela
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {apps.data.map((app) => (
            <li key={app.id}>
              <Card className="relative h-full has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50">
                <CardHeader>
                  <CardTitle className="truncate">
                    <Link
                      href={
                        app.canEdit && app.status === "draft"
                          ? `/apps/${app.id}/edit`
                          : `/apps/${app.id}`
                      }
                      className="inline-block min-h-6 max-w-full truncate align-middle leading-6 outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
                    >
                      {app.name}
                    </Link>
                  </CardTitle>
                  <CardDescription className="line-clamp-2 min-h-10">
                    {app.description || "Sem descrição."}
                  </CardDescription>
                  <CardAction className="relative z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Ações de ${app.name}`}
                          />
                        }
                      >
                        <EllipsisVerticalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          {app.status === "published" ? (
                            <DropdownMenuItem
                              onClick={() => router.push(`/apps/${app.id}`)}
                            >
                              <EyeIcon />
                              Visualizar
                            </DropdownMenuItem>
                          ) : null}
                          {app.canEdit ? (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/apps/${app.id}/edit`)
                                }
                              >
                                <SquarePenIcon />
                                Editar tela
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditing(app)}>
                                <PencilIcon />
                                Renomear e descrição
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                render={
                                  <a
                                    href={`/api/apps/${app.id}/file`}
                                    download
                                  />
                                }
                              >
                                <DownloadIcon />
                                Exportar JSON
                              </DropdownMenuItem>
                            </>
                          ) : null}
                          {canCreate ? (
                            <DropdownMenuItem
                              onClick={() => duplicate.mutate(app.id)}
                            >
                              <CopyIcon />
                              Duplicar
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuGroup>
                        {app.canEdit ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeleting(app)}
                              >
                                <Trash2Icon />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardAction>
                </CardHeader>
                <CardFooter className="mt-auto flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge
                    variant={app.status === "published" ? "success" : "outline"}
                  >
                    {app.status === "published" ? "publicada" : "rascunho"}
                  </Badge>
                  {app.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      #{t}
                    </Badge>
                  ))}
                  <span className="ml-auto truncate">
                    {app.ownerName} ·{" "}
                    {new Date(app.updatedAt).toLocaleDateString("pt-BR")}
                  </span>
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <AppMetaDialog
        open={creating}
        onOpenChange={setCreating}
        canUseQueries={canCreate}
      />
      {editing ? (
        <AppMetaDialog
          open={Boolean(editing)}
          onOpenChange={(open) => !open && setEditing(null)}
          app={editing}
          canUseQueries={false}
        />
      ) : null}
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              O rascunho, as versões publicadas e os compartilhamentos serão
              apagados. Não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleting && remove.mutate(deleting.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
