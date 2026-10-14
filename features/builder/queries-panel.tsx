"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  DatabaseIcon,
  LibraryIcon,
  PlayIcon,
  PlusIcon,
  SparklesIcon,
  SquareIcon,
  Trash2Icon,
  WandSparklesIcon,
} from "lucide-react"

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
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { IDENTIFIER, type AppQuery } from "@/lib/app-schema"
import { api, errorMessage } from "@/lib/api-client"
import { COLUMN_KIND_LABELS, type ResultColumn } from "@/lib/data-types"
import type { ConnectionView } from "@/lib/connections/schema"
import type { SavedQueryView } from "@/lib/queries/schema"
import { SqlParamError, syncParams, type SqlDialect } from "@/lib/sql-params"
import type { RawParamValues } from "@/lib/sql-params/types"
import { suggestWidgets, type Suggestion } from "@/lib/widgets/suggest"
import { WIDGET_INFO } from "@/lib/widgets/registry"

import { useSchema } from "../connections/schema-browser"
import { ParamsConfig } from "../query-editor/params-config"
import { defaultValues } from "../query-editor/query-editor"
import { SqlEditor } from "../query-editor/sql-editor"
import { useExecution } from "../query-editor/use-execution"

export function QueryDialog({
  appId,
  query,
  connections,
  takenNames,
  open,
  onOpenChange,
  onSave,
  onAddWidget,
  onGenerate,
  bindingSuggestions = [],
  otherQueries = [],
}: {
  /** e.g. `{{tabela1.selectedRow.cliente_id}}`, offered as parameter sources. */
  bindingSuggestions?: string[]
  /** Other queries of the screen (options of list/multi parameters). */
  otherQueries?: { id: string; name: string; columns: string[] }[]
  appId: string
  query: AppQuery
  connections: ConnectionView[]
  takenNames: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (query: AppQuery) => void
  onAddWidget: (
    query: AppQuery,
    suggestion: Suggestion,
    values: RawParamValues
  ) => void
  onGenerate: (
    query: AppQuery,
    columns: ResultColumn[],
    rowCount: number,
    values: RawParamValues
  ) => void
}) {
  const [draft, setDraft] = React.useState(query)
  const [values, setValues] = React.useState<RawParamValues>(() =>
    defaultValues(query.params)
  )
  const [paramError, setParamError] = React.useState<string | null>(null)
  const execution = useExecution()
  const connection = connections.find((c) => c.id === draft.connectionId)
  const dialect = (connection?.dialect ?? "postgres") as SqlDialect
  const schema = useSchema(draft.connectionId)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const params = syncParams(draft.sql, draft.params, dialect)
        setParamError(null)
        if (JSON.stringify(params) !== JSON.stringify(draft.params))
          setDraft((d) => ({ ...d, params }))
      } catch (error) {
        setParamError(
          error instanceof SqlParamError ? error.message : String(error)
        )
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [draft.sql, draft.params, dialect])

  const nameError = !IDENTIFIER.test(draft.name)
    ? "Use letras, números e _ (sem espaços)."
    : takenNames.includes(draft.name)
      ? "Já existe uma query ou componente com esse nome."
      : null

  const run = () =>
    void execution.run({
      connectionId: draft.connectionId,
      sql: draft.sql,
      params: draft.params,
      values,
      source: "app",
      appId,
      queryName: draft.name,
    })

  const result =
    execution.state.status === "success" ? execution.state.result : null
  const suggestions = result
    ? suggestWidgets(result.columns, result.rowCount)
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94svh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Query da tela</DialogTitle>
          <DialogDescription>
            Use <code>{`{{${draft.name}.data}}`}</code> para ligar componentes
            ao resultado.
            {query.sourceQueryId
              ? " Copiada da biblioteca: editar aqui não altera a original."
              : ""}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field data-invalid={nameError ? true : undefined}>
              <FieldLabel htmlFor="app-query-name">Nome</FieldLabel>
              <Input
                id="app-query-name"
                className="font-mono"
                value={draft.name}
                spellCheck={false}
                aria-invalid={nameError ? true : undefined}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value.trim() }))
                }
              />
              {nameError ? <FieldError>{nameError}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="app-query-connection">Conexão</FieldLabel>
              <SimpleSelect
                id="app-query-connection"
                items={connections.map((c) => ({ value: c.id, label: c.name }))}
                value={draft.connectionId}
                onValueChange={(connectionId) =>
                  setDraft((d) => ({ ...d, connectionId }))
                }
              />
            </Field>
            <Field>
              <FieldLabel id="app-query-mode-label">Execução</FieldLabel>
              <ToggleGroup
                aria-labelledby="app-query-mode-label"
                variant="outline"
                value={[draft.runMode]}
                onValueChange={(value) => {
                  const next = (value as string[])[0]
                  if (next === "auto" || next === "manual")
                    setDraft((d) => ({ ...d, runMode: next }))
                }}
              >
                <ToggleGroupItem value="auto">Automática</ToggleGroupItem>
                <ToggleGroupItem value="manual">Manual</ToggleGroupItem>
              </ToggleGroup>
            </Field>
          </div>
          <SqlEditor
            value={draft.sql}
            onChange={(sql) => setDraft((d) => ({ ...d, sql }))}
            dialect={dialect}
            schema={schema.data}
            onRun={run}
            label="SQL da query da tela"
            minHeight="160px"
          />
          {paramError ? (
            <Alert variant="destructive">
              <AlertDescription>{paramError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {execution.state.status === "running" ? (
              <Button
                variant="destructive"
                onClick={() => void execution.cancel()}
              >
                <SquareIcon data-icon="inline-start" />
                Cancelar
              </Button>
            ) : (
              <Button variant="outline" onClick={run}>
                <PlayIcon data-icon="inline-start" />
                Executar e ver colunas
              </Button>
            )}
            <ParamsConfig
              params={draft.params}
              onChange={(params) => setDraft((d) => ({ ...d, params }))}
            />
            <Field orientation="horizontal" className="w-auto">
              <FieldLabel
                htmlFor="app-query-cache"
                className="font-normal whitespace-nowrap"
              >
                Cache (s)
              </FieldLabel>
              <Input
                id="app-query-cache"
                className="w-20"
                inputMode="numeric"
                value={String(draft.cacheTtlSeconds)}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    cacheTtlSeconds:
                      Number(e.target.value.replace(/\D/g, "")) || 0,
                  }))
                }
              />
            </Field>
          </div>
          <ParamsForm
            params={draft.params}
            values={values}
            onChange={(name, value) =>
              setValues((v) => ({ ...v, [name]: value }))
            }
            idPrefix="app-query-param"
          />
          {draft.params.length ? (
            <ParamSources
              draft={draft}
              onChange={setDraft}
              suggestions={bindingSuggestions}
              otherQueries={otherQueries.filter((q) => q.id !== draft.id)}
            />
          ) : null}
          {execution.state.status === "error" ? (
            <Alert variant="destructive">
              <AlertDescription>{execution.state.message}</AlertDescription>
            </Alert>
          ) : null}
          {result ? (
            <div className="flex flex-col gap-3" aria-live="polite">
              <div>
                <h3 className="mb-1.5 text-sm font-medium">
                  Colunas ({result.rowCount}{" "}
                  {result.rowCount === 1 ? "linha" : "linhas"})
                </h3>
                <ul className="flex flex-wrap gap-1.5">
                  {result.columns.map((c) => (
                    <li key={c.name}>
                      <Badge variant="outline" className="font-mono">
                        {c.name} · {COLUMN_KIND_LABELS[c.kind]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                  <SparklesIcon className="size-4" aria-hidden />
                  Componentes sugeridos
                </h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {suggestions.map((s, i) => (
                    <li key={`${s.type}-${i}`}>
                      <Item variant="outline" size="sm">
                        <ItemContent>
                          <ItemTitle>{WIDGET_INFO[s.type].label}</ItemTitle>
                          <ItemDescription>{s.reason}</ItemDescription>
                        </ItemContent>
                        <ItemActions>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={Boolean(nameError)}
                            onClick={() => {
                              onSave(draft)
                              onAddWidget(draft, s, values)
                            }}
                          >
                            Adicionar
                          </Button>
                        </ItemActions>
                      </Item>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </FieldGroup>
        <DialogFooter className="gap-2">
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button
            variant="secondary"
            disabled={!result || Boolean(nameError)}
            onClick={() => {
              onSave(draft)
              onGenerate(draft, result!.columns, result!.rowCount, values)
              onOpenChange(false)
            }}
          >
            <WandSparklesIcon data-icon="inline-start" />
            Gerar tela automática
          </Button>
          <Button
            disabled={Boolean(nameError) || !draft.sql.trim()}
            onClick={() => {
              onSave(draft)
              onOpenChange(false)
            }}
          >
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function LibraryDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (query: SavedQueryView) => void
}) {
  const [search, setSearch] = React.useState("")
  const library = useQuery({
    queryKey: ["queries", { q: search }],
    queryFn: () =>
      api<SavedQueryView[]>(`/api/queries?q=${encodeURIComponent(search)}`),
    enabled: open,
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Usar query da biblioteca</DialogTitle>
          <DialogDescription>
            A query é copiada para a tela (com referência à original), para que
            versões publicadas não mudem quando alguém editar a biblioteca.
          </DialogDescription>
        </DialogHeader>
        <Input
          aria-label="Buscar na biblioteca"
          placeholder="Buscar por nome, descrição ou tag"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {library.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(library.error)}</AlertDescription>
          </Alert>
        ) : null}
        <ul className="flex flex-col gap-2">
          {(library.data ?? []).map((saved) => (
            <li key={saved.id}>
              <Item variant="outline" size="sm">
                <ItemContent>
                  <ItemTitle>{saved.name}</ItemTitle>
                  <ItemDescription>
                    {saved.description || saved.connectionName}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button size="sm" onClick={() => onPick(saved)}>
                    Usar
                  </Button>
                </ItemActions>
              </Item>
            </li>
          ))}
          {library.data?.length === 0 ? (
            <li className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma query salva encontrada.
            </li>
          ) : null}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

export function QueriesList({
  queries,
  onOpen,
  onNew,
  onLibrary,
  onRemove,
  canCreate,
}: {
  queries: AppQuery[]
  onOpen: (query: AppQuery) => void
  onNew: () => void
  onLibrary: () => void
  onRemove: (query: AppQuery) => void
  canCreate: boolean
}) {
  return (
    <section aria-label="Queries da tela" className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={onNew}
          disabled={!canCreate}
        >
          <PlusIcon data-icon="inline-start" />
          Nova query
        </Button>
        <Button size="sm" variant="outline" onClick={onLibrary}>
          <LibraryIcon data-icon="inline-start" />
          Da biblioteca
        </Button>
      </div>
      {!canCreate ? (
        <FieldDescription>
          Você precisa de acesso a uma conexão para criar queries.
        </FieldDescription>
      ) : null}
      {queries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma query. Crie uma ou traga da biblioteca.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {queries.map((query) => (
            <li key={query.id}>
              <Item variant="outline" size="sm">
                <ItemContent>
                  <ItemTitle className="font-mono">{query.name}</ItemTitle>
                  <ItemDescription>
                    {query.runMode === "auto" ? "automática" : "manual"}
                    {query.params.length
                      ? ` · ${query.params.map((p) => `:${p.name}`).join(" ")}`
                      : ""}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onOpen(query)}
                    aria-label={`Editar query ${query.name}`}
                  >
                    <DatabaseIcon data-icon="inline-start" />
                    Editar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Remover query ${query.name}`}
                        />
                      }
                    >
                      <Trash2Icon />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Remover a query “{query.name}”?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Componentes ligados a ela ficarão sem dados. Você pode
                          desfazer depois.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={() => onRemove(query)}
                        >
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </ItemActions>
              </Item>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const VARIABLE = "__variable__"
const CUSTOM = "__custom__"

/**
 * Where each parameter value comes from (v2 `paramBindings`): the variable of
 * the same name (filters/URL), or a binding such as a clicked row of a table
 * (chained filters). List/multi parameters may take options from a query.
 */
function ParamSources({
  draft,
  onChange,
  suggestions,
  otherQueries,
}: {
  draft: AppQuery
  onChange: React.Dispatch<React.SetStateAction<AppQuery>>
  suggestions: string[]
  otherQueries: { id: string; name: string; columns: string[] }[]
}) {
  const setBinding = (name: string, template: string | null) =>
    onChange((d) => {
      const next = { ...d.paramBindings }
      if (template === null) delete next[name]
      else next[name] = template
      return { ...d, paramBindings: next }
    })
  return (
    <section
      aria-label="Origem dos parâmetros"
      className="flex flex-col gap-3 rounded-lg border p-3"
    >
      <h3 className="text-sm font-medium">Origem dos parâmetros</h3>
      {draft.params.map((param) => {
        const template = draft.paramBindings[param.name]
        const choice =
          template === undefined
            ? VARIABLE
            : suggestions.includes(template)
              ? template
              : CUSTOM
        const id = `param-source-${param.name}`
        const optionsQuery = otherQueries.find(
          (q) => q.id === param.optionsQuery?.queryId
        )
        return (
          <div key={param.name} className="grid gap-2 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={id}>
                <code>:{param.name}</code> vem de
              </FieldLabel>
              <SimpleSelect
                id={id}
                items={[
                  {
                    value: VARIABLE,
                    label: `Filtro/URL (variável ${param.name})`,
                  },
                  ...suggestions.map((s) => ({ value: s, label: s })),
                  { value: CUSTOM, label: "Binding personalizado" },
                ]}
                value={choice}
                onValueChange={(value) =>
                  setBinding(
                    param.name,
                    value === VARIABLE
                      ? null
                      : value === CUSTOM
                        ? (template ?? "{{}}")
                        : value
                  )
                }
              />
              {choice === CUSTOM ? (
                <Input
                  aria-label={`Binding de ${param.name}`}
                  className="font-mono text-xs"
                  value={template ?? ""}
                  spellCheck={false}
                  onChange={(e) => setBinding(param.name, e.target.value)}
                />
              ) : null}
            </Field>
            {param.type === "list" || param.type === "multi" ? (
              <Field>
                <FieldLabel htmlFor={`${id}-options`}>
                  Opções vindas da query
                </FieldLabel>
                <SimpleSelect
                  id={`${id}-options`}
                  items={[
                    { value: "__none__", label: "(opções fixas)" },
                    ...otherQueries.flatMap((q) =>
                      q.columns.map((c) => ({
                        value: `${q.id}::${c}`,
                        label: `${q.name}.${c}`,
                      }))
                    ),
                  ]}
                  value={
                    optionsQuery && param.optionsQuery
                      ? `${optionsQuery.id}::${param.optionsQuery.valueColumn}`
                      : "__none__"
                  }
                  onValueChange={(value) =>
                    onChange((d) => ({
                      ...d,
                      params: d.params.map((p) => {
                        if (p.name !== param.name) return p
                        if (value === "__none__")
                          return { ...p, optionsQuery: undefined }
                        const [queryId, valueColumn] = value.split("::")
                        return {
                          ...p,
                          optionsQuery: {
                            queryId: queryId!,
                            valueColumn: valueColumn!,
                          },
                        }
                      }),
                    }))
                  }
                />
                <FieldDescription>
                  Execute a outra query no construtor para ver as colunas.
                </FieldDescription>
              </Field>
            ) : null}
          </div>
        )
      })}
    </section>
  )
}
