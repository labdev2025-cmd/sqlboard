"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  DatabaseIcon,
  PlayIcon,
  SaveIcon,
  SquareIcon,
  Trash2Icon,
} from "lucide-react"

import { PageHeader } from "@/components/app-shell/page-header"
import { ParamsForm } from "@/components/params/param-inputs"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
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
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { api, errorMessage } from "@/lib/api-client"
import { postAndDownload } from "@/lib/download"
import type { ConnectionView } from "@/lib/connections/schema"
import type { SavedQueryView } from "@/lib/queries/schema"
import { SqlParamError, syncParams, type SqlDialect } from "@/lib/sql-params"
import type {
  ParamDefinition,
  RawParamValue,
  RawParamValues,
} from "@/lib/sql-params/types"

import { SchemaBrowser, useSchema } from "../connections/schema-browser"
import { AiImproveDialog } from "./ai-improve-dialog"
import { ParamsConfig } from "./params-config"
import { ResultPanel } from "./result-panel"
import { SqlEditor, type SqlEditorHandle } from "./sql-editor"
import { useExecution } from "./use-execution"
import { VersionsSheet } from "./versions-sheet"

export function defaultValues(params: ParamDefinition[]): RawParamValues {
  return Object.fromEntries(
    params.map((p) => [p.name, p.default ?? (p.type === "multi" ? [] : "")])
  )
}

function parseTags(text: string) {
  return text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
}

export function QueryEditor({
  query,
  connections,
}: {
  query?: SavedQueryView
  connections: ConnectionView[]
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const editorRef = React.useRef<SqlEditorHandle>(null)
  const readable = connections.filter((c) => c.purpose === "read")
  const [connectionId, setConnectionId] = React.useState<string | null>(
    query?.connectionId ?? readable[0]?.id ?? null
  )
  const connection = readable.find((c) => c.id === connectionId)
  const dialect = (connection?.dialect ?? "postgres") as SqlDialect
  const [sql, setSql] = React.useState(
    query?.sql ??
      "select *\nfrom loja.pedidos\nwhere status = :status\nlimit 100"
  )
  const [params, setParams] = React.useState<ParamDefinition[]>(
    query?.params ?? []
  )
  const [values, setValues] = React.useState<RawParamValues>(() =>
    defaultValues(query?.params ?? [])
  )
  const [paramError, setParamError] = React.useState<string | null>(null)
  const [saveOpen, setSaveOpen] = React.useState(false)
  const [meta, setMeta] = React.useState({
    name: query?.name ?? "",
    description: query?.description ?? "",
    tags: (query?.tags ?? []).join(", "),
    cacheTtlSeconds: String(query?.cacheTtlSeconds ?? 0),
  })
  const schema = useSchema(connectionId)
  const execution = useExecution()
  const canEdit = query ? query.canEdit : true

  // Detect parameters as the SQL changes (keeping the user's settings).
  React.useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const next = syncParams(sql, params, dialect)
        setParamError(null)
        if (JSON.stringify(next) !== JSON.stringify(params)) setParams(next)
      } catch (error) {
        setParamError(
          error instanceof SqlParamError ? error.message : String(error)
        )
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [sql, params, dialect])

  const run = React.useCallback(() => {
    if (!connectionId) return
    void execution.run({
      connectionId,
      sql,
      params,
      values,
      savedQueryId: query?.id,
    })
  }, [connectionId, execution, sql, params, values, query?.id])

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: meta.name,
        description: meta.description,
        tags: parseTags(meta.tags),
        cacheTtlSeconds: Number(meta.cacheTtlSeconds) || 0,
        connectionId,
        sql,
        params,
      }
      return query
        ? api<SavedQueryView>(`/api/queries/${query.id}`, {
            method: "PUT",
            body,
          })
        : api<SavedQueryView>("/api/queries", { method: "POST", body })
    },
    onSuccess: (saved) => {
      toast.add({
        title: "Query salva",
        description: `Versão ${saved.version}`,
        type: "success",
      })
      setSaveOpen(false)
      void queryClient.invalidateQueries({ queryKey: ["queries"] })
      void queryClient.invalidateQueries({
        queryKey: ["query-versions", saved.id],
      })
      if (!query) router.replace(`/queries/${saved.id}`)
      else router.refresh()
    },
  })

  const remove = useMutation({
    mutationFn: () => api(`/api/queries/${query!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.add({ title: "Query excluída", type: "success" })
      void queryClient.invalidateQueries({ queryKey: ["queries"] })
      router.push("/queries")
    },
    onError: (error) =>
      toast.add({
        title: "Não foi possível excluir",
        description: errorMessage(error),
        type: "error",
      }),
  })

  function applySql(next: string) {
    const previous = sql
    setSql(next)
    toast.add({
      title: "Query aplicada no editor",
      description: "Salve para registrar uma nova versão no histórico.",
      type: "success",
      actionProps: { children: "Desfazer", onClick: () => setSql(previous) },
    })
  }

  const running = execution.state.status === "running"
  const lastRun =
    execution.state.status === "success"
      ? {
          durationMs: execution.state.result.durationMs,
          rowCount: execution.state.result.rowCount,
          truncated: execution.state.result.truncated,
        }
      : undefined

  if (readable.length === 0) {
    return (
      <>
        <PageHeader title={query?.name ?? "Nova query"} />
        <div className="p-4 md:p-6">
          <Alert>
            <DatabaseIcon />
            <AlertDescription>
              Você ainda não tem acesso a nenhuma conexão de leitura. Peça a um
              administrador.
            </AlertDescription>
          </Alert>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={query?.name ?? "Nova query"}
        description={
          query
            ? `Versão ${query.version} · ${query.connectionName}`
            : "Rascunho não salvo"
        }
        actions={
          <>
            {query ? (
              <VersionsSheet
                queryId={query.id}
                canRestore={canEdit}
                onRestored={() => router.refresh()}
              />
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSaveOpen(true)}
              disabled={!canEdit}
            >
              <SaveIcon data-icon="inline-start" />
              Salvar
            </Button>
            {query && canEdit ? (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Excluir query"
                    />
                  }
                >
                  <Trash2Icon />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir “{query.name}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O histórico de versões também será excluído. Telas que
                      usam uma cópia desta query continuam funcionando.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => remove.mutate()}
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </>
        }
      />
      <div className="grid min-w-0 flex-1 gap-4 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-end gap-2">
            <Field className="w-full max-w-64">
              <FieldLabel htmlFor="query-connection">Conexão</FieldLabel>
              <SimpleSelect
                id="query-connection"
                items={readable.map((c) => ({ value: c.id, label: c.name }))}
                value={connectionId}
                onValueChange={setConnectionId}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              {running ? (
                <Button
                  variant="destructive"
                  onClick={() => void execution.cancel()}
                >
                  <SquareIcon data-icon="inline-start" />
                  Cancelar
                </Button>
              ) : (
                <Button onClick={run} disabled={!connectionId || !sql.trim()}>
                  <PlayIcon data-icon="inline-start" />
                  Executar
                  <Kbd className="hidden sm:inline-flex">Ctrl ↵</Kbd>
                </Button>
              )}
              <ParamsConfig params={params} onChange={setParams} />
              <AiImproveDialog
                sql={sql}
                dialect={dialect}
                connectionId={connectionId}
                schema={schema.data}
                params={params}
                values={values}
                lastRun={lastRun}
                onApply={applySql}
              />
              <Sheet>
                <SheetTrigger
                  render={
                    <Button variant="outline" size="sm" className="xl:hidden" />
                  }
                >
                  <DatabaseIcon data-icon="inline-start" />
                  Schema
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-sm">
                  <SheetHeader>
                    <SheetTitle>Schema</SheetTitle>
                    <SheetDescription>
                      Toque num nome para inserir no editor.
                    </SheetDescription>
                  </SheetHeader>
                  {connectionId ? (
                    <SchemaBrowser
                      connectionId={connectionId}
                      className="min-h-0 flex-1 px-4 pb-4"
                      onInsert={(text) => editorRef.current?.insert(text)}
                    />
                  ) : null}
                </SheetContent>
              </Sheet>
            </div>
          </div>
          <SqlEditor
            ref={editorRef}
            value={sql}
            onChange={setSql}
            dialect={dialect}
            schema={schema.data}
            onRun={run}
            label="Editor SQL"
          />
          {paramError ? (
            <Alert variant="destructive">
              <AlertDescription>{paramError}</AlertDescription>
            </Alert>
          ) : null}
          <ParamsForm
            params={params}
            values={values}
            onChange={(name: string, value: RawParamValue) =>
              setValues((prev) => ({ ...prev, [name]: value }))
            }
          />
          <section aria-label="Resultado" className="min-w-0">
            <ResultPanel
              state={execution.state}
              sql={sql}
              onExport={(format) => {
                if (!connectionId) return
                void postAndDownload(
                  "/api/export",
                  {
                    connectionId,
                    sql,
                    params,
                    values,
                    format,
                    savedQueryId: query?.id,
                    fileName: query?.name ?? "query",
                  },
                  `query.${format}`
                ).catch((error) =>
                  toast.add({
                    title: "Não foi possível exportar",
                    description: errorMessage(error),
                    type: "error",
                  })
                )
              }}
            />
          </section>
        </div>
        <aside
          className="hidden min-h-0 xl:flex xl:flex-col"
          aria-label="Schema da conexão"
        >
          <h2 className="mb-2 text-sm font-medium">Schema</h2>
          {connectionId ? (
            <SchemaBrowser
              connectionId={connectionId}
              className="max-h-[calc(100svh-10rem)]"
              onInsert={(text) => editorRef.current?.insert(text)}
            />
          ) : null}
        </aside>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              save.mutate()
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {query ? "Salvar query" : "Salvar na biblioteca"}
              </DialogTitle>
              <DialogDescription>
                Cada alteração no SQL ou nos parâmetros gera uma versão no
                histórico.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              {save.isError ? (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>
                    {errorMessage(save.error)}
                  </AlertDescription>
                </Alert>
              ) : null}
              <Field>
                <FieldLabel htmlFor="query-name">Nome</FieldLabel>
                <Input
                  id="query-name"
                  value={meta.name}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, name: e.target.value }))
                  }
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="query-description">Descrição</FieldLabel>
                <Textarea
                  id="query-description"
                  value={meta.description}
                  rows={3}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, description: e.target.value }))
                  }
                  placeholder="O que esta query responde e para quem."
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="query-tags">Tags</FieldLabel>
                <Input
                  id="query-tags"
                  value={meta.tags}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, tags: e.target.value }))
                  }
                  placeholder="vendas, mensal"
                />
                <FieldDescription>Separe por vírgula.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="query-cache">
                  Cache do resultado (segundos)
                </FieldLabel>
                <Input
                  id="query-cache"
                  inputMode="numeric"
                  value={meta.cacheTtlSeconds}
                  onChange={(e) =>
                    setMeta((m) => ({
                      ...m,
                      cacheTtlSeconds: e.target.value.replace(/\D/g, ""),
                    }))
                  }
                />
                <FieldDescription>
                  0 desliga o cache. Vale nas telas que usam esta query.
                </FieldDescription>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? <Spinner data-icon="inline-start" /> : null}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
