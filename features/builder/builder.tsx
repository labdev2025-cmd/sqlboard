"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CheckIcon,
  CloudOffIcon,
  EyeIcon,
  LayersIcon,
  PencilIcon,
  PlusIcon,
  Redo2Icon,
  SaveIcon,
  SlidersHorizontalIcon,
  Undo2Icon,
} from "lucide-react"
import type { Layout } from "react-grid-layout"

import { PageHeader } from "@/components/app-shell/page-header"
import { ParamsForm } from "@/components/params/param-inputs"
import {
  WidgetContent,
  WidgetFrame,
  type WidgetActions,
} from "@/components/widgets/widget-view"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { api, ApiError, errorMessage } from "@/lib/api-client"
import {
  allIdentifiers,
  IDENTIFIER,
  shortId,
  type AppDocument,
  type AppQuery,
  type GridPosition,
  type Widget,
} from "@/lib/app-schema"
import type { ConnectionView } from "@/lib/connections/schema"
import type { QueryResult, ResultColumn } from "@/lib/data-types"
import type { RawParamValues } from "@/lib/sql-params/types"
import {
  WIDGET_INFO,
  widgetVariables,
  type WidgetType,
} from "@/lib/widgets/registry"
import { generateScreen, type Suggestion } from "@/lib/widgets/suggest"

import { PageGrid } from "../app-runtime/app-viewer"
import { downloadExport } from "../app-runtime/export"
import { useAppRuntime, type QueryRunner } from "../app-runtime/use-app-runtime"
import { Canvas } from "./canvas"
import { Palette } from "./palette"
import { PropertiesPanel } from "./properties-panel"
import { AiScreenDialog } from "./ai-screen-dialog"
import { PublishDialog, ShareDialog, VersionsPanel } from "./publish"
import { LibraryDialog, QueriesList, QueryDialog } from "./queries-panel"
import {
  bottomY,
  clampGrid,
  createWidget,
  currentPage,
  findWidget,
  newQuery,
  renameQueryIn,
  updateWidgetIn,
  useBuilder,
} from "./store"
import { querySnapshot } from "@/lib/app-schema/snapshot"

type SaveState = "saved" | "saving" | "dirty" | "error"

export type BuilderApp = {
  id: string
  ownerId: string
  document: AppDocument
  updatedAt: string
  publishedVersion: number | null
}

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  )
}

function renameIdentifier(
  doc: AppDocument,
  oldId: string,
  newId: string
): AppDocument {
  const pattern = new RegExp(`(\\{\\{\\s*)${oldId}(?=[.\\[\\s}])`, "g")
  const rewrite = (value: unknown) =>
    typeof value === "string" ? value.replace(pattern, `$1${newId}`) : value
  return {
    ...doc,
    pages: doc.pages.map((page) => ({
      ...page,
      widgets: page.widgets.map(
        (w) =>
          ({
            ...w,
            id: w.id === oldId ? newId : w.id,
            bindings: Object.fromEntries(
              Object.entries(w.bindings).map(([k, v]) => [
                k,
                rewrite(v) as string,
              ])
            ),
            props: Object.fromEntries(
              Object.entries(w.props).map(([k, v]) => [k, rewrite(v)])
            ),
          }) as Widget
      ),
    })),
  }
}

export function Builder({
  app,
  connections,
}: {
  app: BuilderApp
  connections: ConnectionView[]
}) {
  const router = useRouter()
  const store = useBuilder()
  const {
    doc,
    pageId,
    selection,
    change,
    select,
    setPage,
    undo,
    redo,
    past,
    future,
    revision,
  } = store
  const [mode, setMode] = React.useState<"edit" | "view">("edit")
  const [saveState, setSaveState] = React.useState<SaveState>("saved")
  const [publishedVersion, setPublishedVersion] = React.useState(
    app.publishedVersion
  )
  const [editingQuery, setEditingQuery] = React.useState<AppQuery | null>(null)
  const [libraryOpen, setLibraryOpen] = React.useState(false)
  const [announcement, setAnnouncement] = React.useState("")
  const updatedAt = React.useRef(app.updatedAt)
  const savedRevision = React.useRef(0)
  const saving = React.useRef<Promise<void> | null>(null)

  React.useEffect(() => {
    useBuilder.getState().init(app.document)
  }, [app.document])

  const ready = Boolean(doc) && doc.app.id === app.document.app.id
  const page = ready ? currentPage(doc, pageId) : app.document.pages[0]!
  const document = ready ? doc : app.document

  /* ------------------------------ autosave ------------------------------ */
  const save = React.useCallback(async () => {
    const state = useBuilder.getState()
    const target = state.revision
    if (target === savedRevision.current) return
    setSaveState("saving")
    try {
      const result = await api<{ updatedAt: string }>(
        `/api/apps/${app.id}/draft`,
        {
          method: "PUT",
          body: { document: state.doc, expectedUpdatedAt: updatedAt.current },
        }
      )
      updatedAt.current = result.updatedAt
      savedRevision.current = target
      setSaveState(
        useBuilder.getState().revision === target ? "saved" : "dirty"
      )
    } catch (error) {
      setSaveState("error")
      toast.add({
        title: "Rascunho não salvo",
        description:
          error instanceof ApiError ? error.message : errorMessage(error),
        type: "error",
      })
      throw error
    }
  }, [app.id])

  const flush = React.useCallback(async () => {
    if (saving.current) await saving.current.catch(() => undefined)
    saving.current = save()
    try {
      await saving.current
    } finally {
      saving.current = null
    }
  }, [save])

  React.useEffect(() => {
    if (!ready || revision === 0 || revision === savedRevision.current) return
    setSaveState("dirty")
    const timer = setTimeout(() => void flush().catch(() => undefined), 1200)
    return () => clearTimeout(timer)
  }, [revision, ready, flush])

  React.useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (useBuilder.getState().revision !== savedRevision.current)
        event.preventDefault()
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [])

  /* ------------------------------- runtime ------------------------------ */
  const runner = React.useCallback<QueryRunner>(
    (query, values, signal) =>
      api<QueryResult>("/api/execute", {
        method: "POST",
        body: {
          connectionId: query.connectionId,
          sql: query.sql,
          params: query.params,
          values,
          source: "app",
          appId: app.id,
          queryName: query.name,
        },
        signal,
      }),
    [app.id]
  )
  const runtime = useAppRuntime({
    appId: app.id,
    document,
    page,
    mode: "draft",
    runner,
  })

  const columnsOf = React.useCallback(
    (name: string): ResultColumn[] => {
      const entry = runtime.scope[name] as
        { columns?: ResultColumn[] } | undefined
      return entry?.columns ?? []
    },
    [runtime.scope]
  )

  const actions: WidgetActions = {
    setVariable: runtime.setVariable,
    runQuery: runtime.runByName,
    navigate: (target) => {
      if (document.pages.some((p) => p.id === target)) setPage(target)
    },
    exportQuery: (name, format) => {
      const query = document.queries.find((q) => q.name === name)
      if (!query) return
      void flush()
        .then(() =>
          downloadExport(app.id, {
            queryId: query.id,
            values: runtime.resolve(query),
            mode: "draft",
            format,
          })
        )
        .catch((error) =>
          toast.add({
            title: "Não foi possível exportar",
            description: errorMessage(error),
            type: "error",
          })
        )
    },
    selectRow: (widget, row, index) =>
      runtime.setWidgetState(widget.id, {
        selectedRow: row,
        selectedIndex: index,
      }),
  }

  /* ------------------------------ mutations ----------------------------- */
  const selectedWidget =
    selection?.kind === "widget"
      ? (findWidget(document, selection.id)?.widget ?? null)
      : null

  const addWidget = (
    type: WidgetType,
    position?: { x: number; y: number },
    props?: Record<string, unknown>,
    dataQuery?: string
  ) => {
    let createdId = ""
    change((d) => {
      const target = currentPage(d, pageId)
      const widget = createWidget(
        d,
        target,
        type,
        position,
        dataQuery ?? d.queries[0]?.name
      )
      if (props)
        (widget as { props: Record<string, unknown> }).props = {
          ...widget.props,
          ...props,
        }
      createdId = widget.id
      return {
        ...d,
        pages: d.pages.map((p) =>
          p.id === target.id ? { ...p, widgets: [...p.widgets, widget] } : p
        ),
      }
    })
    if (createdId) {
      select({ kind: "widget", id: createdId })
      setAnnouncement(
        `${WIDGET_INFO[type].label} adicionado como ${createdId}.`
      )
    }
  }

  const removeWidget = (id: string) => {
    change((d) => ({
      ...d,
      pages: d.pages.map((p) => ({
        ...p,
        widgets: p.widgets.filter((w) => w.id !== id),
      })),
    }))
    select(null)
    toast.add({
      title: "Componente removido",
      type: "info",
      actionProps: {
        children: "Desfazer",
        onClick: () => useBuilder.getState().undo(),
      },
    })
  }

  const setGrid = (widget: Widget, grid: GridPosition) => {
    const next = clampGrid(grid, WIDGET_INFO[widget.type].minSize)
    change((d) =>
      updateWidgetIn(d, widget.id, (w) => ({ ...w, grid: next }) as Widget)
    )
    setAnnouncement(
      `${widget.id}: coluna ${next.x + 1}, linha ${next.y + 1}, ${next.w} de largura, ${next.h} de altura.`
    )
  }

  const onLayout = (layout: Layout, fromUser: boolean) => {
    change(
      (d) => ({
        ...d,
        pages: d.pages.map((p) =>
          p.id !== pageId
            ? p
            : {
                ...p,
                widgets: p.widgets.map((w) => {
                  const item = layout.find((l) => l.i === w.id)
                  return item
                    ? ({
                        ...w,
                        grid: clampGrid({
                          x: item.x,
                          y: item.y,
                          w: item.w,
                          h: item.h,
                        }),
                      } as Widget)
                    : w
                }),
              }
        ),
      }),
      { history: fromUser }
    )
  }

  const onKeyboard = (widget: Widget, event: React.KeyboardEvent) => {
    const { x, y, w, h } = widget.grid
    const resize = event.shiftKey
    const moves: Record<string, GridPosition> = resize
      ? {
          ArrowLeft: { x, y, w: w - 1, h },
          ArrowRight: { x, y, w: w + 1, h },
          ArrowUp: { x, y, w, h: h - 1 },
          ArrowDown: { x, y, w, h: h + 1 },
        }
      : {
          ArrowLeft: { x: x - 1, y, w, h },
          ArrowRight: { x: x + 1, y, w, h },
          ArrowUp: { x, y: Math.max(0, y - 1), w, h },
          ArrowDown: { x, y: y + 1, w, h },
        }
    if (moves[event.key]) {
      event.preventDefault()
      setGrid(widget, moves[event.key]!)
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault()
      removeWidget(widget.id)
    } else if (event.key === "Escape") {
      select(null)
    }
  }

  const saveQuery = (query: AppQuery) => {
    change((d) => {
      const existing = d.queries.find((q) => q.id === query.id)
      let next = d
      if (existing && existing.name !== query.name)
        next = renameQueryIn(next, existing.name, query.name)
      return {
        ...next,
        queries: existing
          ? next.queries.map((q) => (q.id === query.id ? query : q))
          : [...next.queries, query],
      }
    })
  }

  const generate = (
    query: AppQuery,
    columns: ResultColumn[],
    rowCount: number,
    values: RawParamValues
  ) => {
    runtime.setVariables((prev) => ({ ...prev, ...values }))
    change((d) => {
      const target = currentPage(d, pageId)
      const widgets = generateScreen(query, columns, rowCount, {
        startY: bottomY(target),
        taken: allIdentifiers(d),
        existingVariables: target.widgets.flatMap((w) => widgetVariables(w)),
      })
      return {
        ...d,
        pages: d.pages.map((p) =>
          p.id === target.id ? { ...p, widgets: [...p.widgets, ...widgets] } : p
        ),
      }
    })
    toast.add({
      title: "Tela gerada",
      description: "Ajuste os componentes como quiser.",
      type: "success",
    })
  }

  const addSuggestion = (
    query: AppQuery,
    suggestion: Suggestion,
    values: RawParamValues
  ) => {
    runtime.setVariables((prev) => ({ ...values, ...prev }))
    addWidget(suggestion.type, undefined, suggestion.props, query.name)
  }

  /* --------------------------- keyboard shortcuts ------------------------ */
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || isTyping(event.target)) return
      const key = event.key.toLowerCase()
      if (key === "z" && !event.shiftKey) {
        event.preventDefault()
        undo()
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault()
        redo()
      } else if (key === "s") {
        event.preventDefault()
        void flush().catch(() => undefined)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [undo, redo, flush])

  if (!ready) {
    return (
      <>
        <PageHeader title={app.document.app.name} />
        <div className="flex flex-1 items-center justify-center p-6">
          <Spinner />
        </div>
      </>
    )
  }

  const readable = connections.filter((c) => c.purpose === "read")
  const takenForQuery = (query: AppQuery) =>
    allIdentifiers(doc).filter(
      (name) => name !== doc.queries.find((q) => q.id === query.id)?.name
    )

  const saveBadge = {
    saved: { icon: CheckIcon, text: "Salvo" },
    saving: { icon: Spinner, text: "Salvando…" },
    dirty: { icon: PencilIcon, text: "Alterações pendentes" },
    error: { icon: CloudOffIcon, text: "Erro ao salvar" },
  }[saveState]

  const palettePanel = <Palette onAdd={(type) => addWidget(type)} />
  const queriesPanel = (
    <QueriesList
      queries={doc.queries}
      canCreate={readable.length > 0}
      onOpen={setEditingQuery}
      onNew={() => {
        const query = newQuery(doc, readable[0]!.id)
        setEditingQuery(query)
      }}
      onLibrary={() => setLibraryOpen(true)}
      onRemove={(query) =>
        change((d) => ({
          ...d,
          queries: d.queries.filter((q) => q.id !== query.id),
        }))
      }
    />
  )
  const leftPanel = (
    <Tabs defaultValue="widgets" className="flex flex-col gap-3">
      <TabsList className="w-full">
        <TabsTrigger value="widgets">Componentes</TabsTrigger>
        <TabsTrigger value="queries">Queries</TabsTrigger>
      </TabsList>
      <TabsContent value="widgets">{palettePanel}</TabsContent>
      <TabsContent value="queries">{queriesPanel}</TabsContent>
    </Tabs>
  )

  const rightPanel = selectedWidget ? (
    <PropertiesPanel
      key={selectedWidget.id}
      widget={selectedWidget}
      doc={doc}
      columnsOf={columnsOf}
      onProps={(props) =>
        change((d) =>
          updateWidgetIn(
            d,
            selectedWidget.id,
            (w) => ({ ...w, props }) as Widget
          )
        )
      }
      onBindings={(bindings) =>
        change((d) =>
          updateWidgetIn(
            d,
            selectedWidget.id,
            (w) => ({ ...w, bindings }) as Widget
          )
        )
      }
      onGrid={(grid) => setGrid(selectedWidget, grid)}
      onRename={(next) => {
        if (!IDENTIFIER.test(next))
          return "Use letras, números e _ (sem espaços)."
        if (next !== selectedWidget.id && allIdentifiers(doc).includes(next))
          return "Esse id já está em uso."
        change((d) => renameIdentifier(d, selectedWidget.id, next))
        select({ kind: "widget", id: next })
        return null
      }}
      onRemove={() => removeWidget(selectedWidget.id)}
    />
  ) : (
    <PageSettings
      doc={doc}
      pageId={page.id}
      onChange={(fn) => change(fn)}
      onRemovePage={() => {
        change((d) => ({
          ...d,
          pages: d.pages.filter((p) => p.id !== page.id),
        }))
        setPage(doc.pages.find((p) => p.id !== page.id)!.id)
      }}
    />
  )

  return (
    <>
      <PageHeader
        title={doc.app.name}
        description={
          <span className="inline-flex items-center gap-1.5">
            <saveBadge.icon className="size-3" aria-hidden />
            <span aria-live="polite">{saveBadge.text}</span>
            {publishedVersion ? (
              <Badge variant="success">publicada v{publishedVersion}</Badge>
            ) : (
              <Badge variant="outline">rascunho</Badge>
            )}
          </span>
        }
        actions={
          <>
            <ToggleGroup
              variant="outline"
              size="sm"
              value={[mode]}
              onValueChange={(value) => {
                const next = (value as string[])[0]
                if (next === "edit" || next === "view") setMode(next)
              }}
              aria-label="Modo"
            >
              <ToggleGroupItem value="edit" aria-label="Editar">
                <PencilIcon />
                <span className="hidden sm:inline">Editar</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="view" aria-label="Visualizar">
                <EyeIcon />
                <span className="hidden sm:inline">Visualizar</span>
              </ToggleGroupItem>
            </ToggleGroup>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Desfazer"
                    onClick={undo}
                    disabled={!past.length}
                  />
                }
              >
                <Undo2Icon />
              </TooltipTrigger>
              <TooltipContent>Desfazer (Ctrl+Z)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Refazer"
                    onClick={redo}
                    disabled={!future.length}
                  />
                }
              >
                <Redo2Icon />
              </TooltipTrigger>
              <TooltipContent>Refazer (Ctrl+Shift+Z)</TooltipContent>
            </Tooltip>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void flush().catch(() => undefined)}
              disabled={saveState === "saved" || saveState === "saving"}
            >
              <SaveIcon data-icon="inline-start" />
              Salvar
            </Button>
            <AiScreenDialog
              doc={doc}
              onApply={(next) => {
                change(() => next)
                setPage(next.pages[0]!.id)
              }}
            />
            <VersionsPanel appId={app.id} onRestored={() => router.refresh()} />
            <ShareDialog appId={app.id} ownerId={app.ownerId} />
            {publishedVersion ? (
              <Link
                href={`/apps/${app.id}`}
                className={buttonVariants({ size: "sm", variant: "ghost" })}
              >
                Abrir publicada
              </Link>
            ) : null}
            <PublishDialog
              appId={app.id}
              beforePublish={flush}
              onPublished={setPublishedVersion}
            />
          </>
        }
      />
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-3 md:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={page.id}
            onValueChange={(value) => setPage(String(value))}
            className="min-w-0"
          >
            <TabsList className="max-w-full overflow-x-auto">
              {doc.pages.map((p) => (
                <TabsTrigger key={p.id} value={p.id}>
                  {p.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {mode === "edit" ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const id = shortId("p")
                change((d) => ({
                  ...d,
                  pages: [
                    ...d.pages,
                    {
                      id,
                      name: `Página ${d.pages.length + 1}`,
                      layout: { cols: 12, rowHeight: 40 },
                      widgets: [],
                    },
                  ],
                }))
                setPage(id)
              }}
            >
              <PlusIcon data-icon="inline-start" />
              Página
            </Button>
          ) : null}
          {mode === "edit" ? (
            <div className="ml-auto flex gap-2 lg:hidden">
              <Sheet>
                <SheetTrigger render={<Button size="sm" variant="outline" />}>
                  <LayersIcon data-icon="inline-start" />
                  Componentes
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-full overflow-y-auto sm:max-w-sm"
                >
                  <SheetHeader>
                    <SheetTitle>Componentes e queries</SheetTitle>
                    <SheetDescription>
                      Toque num componente para adicioná-lo à página.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="px-4 pb-4">{leftPanel}</div>
                </SheetContent>
              </Sheet>
              <Sheet>
                <SheetTrigger render={<Button size="sm" variant="outline" />}>
                  <SlidersHorizontalIcon data-icon="inline-start" />
                  Propriedades
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="w-full overflow-y-auto sm:max-w-sm"
                >
                  <SheetHeader>
                    <SheetTitle>Propriedades</SheetTitle>
                    <SheetDescription>
                      {selectedWidget ? selectedWidget.id : "Página e tela"}
                    </SheetDescription>
                  </SheetHeader>
                  <div className="px-4 pb-4">{rightPanel}</div>
                </SheetContent>
              </Sheet>
            </div>
          ) : null}
        </div>

        {runtime.freeParams.length || runtime.hasManual ? (
          <section
            aria-label="Parâmetros"
            className="flex flex-col gap-3 rounded-xl border p-3 md:flex-row md:items-end"
          >
            <ParamsForm
              className="min-w-0 flex-1"
              params={runtime.freeParams}
              values={runtime.variables}
              onChange={runtime.setVariable}
              idPrefix="filtro"
              optionsFor={runtime.paramOptions}
            />
            {runtime.hasManual ? (
              <Button onClick={runtime.runManual}>Executar</Button>
            ) : null}
          </section>
        ) : null}

        {mode === "view" ? (
          <PageGrid
            page={page}
            render={(widget) => (
              <WidgetFrame widget={widget} scope={runtime.scope}>
                <WidgetContent
                  widget={widget}
                  scope={runtime.scope}
                  variables={runtime.variables}
                  actions={actions}
                  selectedIndex={runtime.widgetStates[widget.id]?.selectedIndex}
                  pages={doc.pages}
                />
              </WidgetFrame>
            )}
          />
        ) : (
          <div className="grid min-w-0 gap-4 lg:grid-cols-[14rem_minmax(0,1fr)_18rem]">
            <aside className="hidden lg:block" aria-label="Paleta e queries">
              <div className="sticky top-16 max-h-[calc(100svh-5rem)] overflow-y-auto pr-1">
                {leftPanel}
              </div>
            </aside>
            <Canvas
              page={page}
              runtime={runtime}
              actions={actions}
              selectedId={selectedWidget?.id ?? null}
              onSelect={(id) => select(id ? { kind: "widget", id } : null)}
              onLayout={onLayout}
              onDropWidget={(type, at) => addWidget(type, at)}
              onKeyboard={onKeyboard}
            />
            <aside className="hidden lg:block" aria-label="Propriedades">
              <div className="sticky top-16 max-h-[calc(100svh-5rem)] overflow-y-auto pr-1">
                <h2 className="mb-3 text-sm font-medium">
                  {selectedWidget ? "Propriedades" : "Página e tela"}
                </h2>
                {rightPanel}
              </div>
            </aside>
          </div>
        )}
      </div>

      {editingQuery ? (
        <QueryDialog
          key={editingQuery.id}
          appId={app.id}
          query={editingQuery}
          connections={readable}
          takenNames={takenForQuery(editingQuery)}
          open={Boolean(editingQuery)}
          onOpenChange={(open) => !open && setEditingQuery(null)}
          onSave={saveQuery}
          onAddWidget={addSuggestion}
          onGenerate={generate}
          bindingSuggestions={doc.pages.flatMap((p) =>
            p.widgets.flatMap((w) => {
              if (WIDGET_INFO[w.type].category === "input")
                return [`{{${w.id}.value}}`]
              if (!WIDGET_INFO[w.type].usesData) return []
              const source =
                /^\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\.data\s*\}\}$/.exec(
                  w.bindings.data ?? ""
                )?.[1]
              return columnsOf(source ?? "").map(
                (c) => `{{${w.id}.selectedRow.${c.name}}}`
              )
            })
          )}
          otherQueries={doc.queries.map((q) => ({
            id: q.id,
            name: q.name,
            columns: columnsOf(q.name).map((c) => c.name),
          }))}
        />
      ) : null}
      <LibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        onPick={(saved) => {
          const query = querySnapshot(saved, allIdentifiers(doc))
          change((d) => ({ ...d, queries: [...d.queries, query] }))
          setLibraryOpen(false)
          setEditingQuery(query)
        }}
      />
    </>
  )
}

function PageSettings({
  doc,
  pageId,
  onChange,
  onRemovePage,
}: {
  doc: AppDocument
  pageId: string
  onChange: (fn: (doc: AppDocument) => AppDocument) => void
  onRemovePage: () => void
}) {
  const page = currentPage(doc, pageId)
  return (
    <div className="flex flex-col gap-5">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="page-name">Nome da página</FieldLabel>
          <Input
            id="page-name"
            value={page.name}
            onChange={(e) =>
              onChange((d) => ({
                ...d,
                pages: d.pages.map((p) =>
                  p.id === pageId
                    ? { ...p, name: e.target.value || "Página" }
                    : p
                ),
              }))
            }
          />
        </Field>
        {doc.pages.length > 1 ? (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={onRemovePage}
          >
            Remover esta página
          </Button>
        ) : null}
      </FieldGroup>
      <Separator />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="app-name">Nome da tela</FieldLabel>
          <Input
            id="app-name"
            value={doc.app.name}
            onChange={(e) =>
              onChange((d) => ({
                ...d,
                app: { ...d.app, name: e.target.value },
              }))
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="app-description">
            Descrição / finalidade
          </FieldLabel>
          <Textarea
            id="app-description"
            rows={4}
            value={doc.app.description}
            onChange={(e) =>
              onChange((d) => ({
                ...d,
                app: { ...d.app, description: e.target.value },
              }))
            }
          />
          <FieldDescription>
            Para que serve, quem usa e de onde vêm os dados. Aparece no modo
            visualização.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="app-tags">Tags</FieldLabel>
          <Input
            id="app-tags"
            value={doc.app.tags.join(", ")}
            onChange={(e) =>
              onChange((d) => ({
                ...d,
                app: {
                  ...d.app,
                  tags: e.target.value
                    .split(",")
                    .map((t) => t.trim().toLowerCase())
                    .filter(Boolean),
                },
              }))
            }
          />
          <FieldDescription>Separe por vírgula.</FieldDescription>
        </Field>
      </FieldGroup>
      <p className="text-xs text-muted-foreground">
        Selecione um componente na grade para editar suas propriedades.
      </p>
    </div>
  )
}
