"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronDownIcon, InfoIcon, PencilIcon, PlayIcon } from "lucide-react"
import { Responsive, useContainerWidth } from "react-grid-layout"

import "react-grid-layout/css/styles.css"

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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/toast"
import type { AppDocument, Page, Widget } from "@/lib/app-schema"
import type { RawParamValues } from "@/lib/sql-params/types"

import { downloadExport } from "./export"
import { useAppRuntime, type RuntimeMode } from "./use-app-runtime"

const PARAM_PREFIX = "p."

/** Reads `?p.uf=CE&p.ids=1&p.ids=2` into variables. */
export function variablesFromSearch(search: URLSearchParams): RawParamValues {
  const values: RawParamValues = {}
  for (const key of new Set(search.keys())) {
    if (!key.startsWith(PARAM_PREFIX)) continue
    const all = search.getAll(key)
    values[key.slice(PARAM_PREFIX.length)] = all.length > 1 ? all : all[0]
  }
  return values
}

function writeUrl(
  variables: RawParamValues,
  pageId: string,
  firstPageId: string
) {
  const url = new URL(window.location.href)
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith(PARAM_PREFIX) || key === "page")
      url.searchParams.delete(key)
  }
  if (pageId !== firstPageId) url.searchParams.set("page", pageId)
  for (const [name, value] of Object.entries(variables)) {
    if (value === null || value === undefined || value === "") continue
    if (Array.isArray(value))
      value.forEach((v) => url.searchParams.append(`${PARAM_PREFIX}${name}`, v))
    else url.searchParams.set(`${PARAM_PREFIX}${name}`, String(value))
  }
  window.history.replaceState(null, "", url)
}

/** Reading order for the stacked mobile layout: y, then x. */
export function stackedLayout(widgets: Widget[]) {
  let y = 0
  return [...widgets]
    .sort((a, b) => a.grid.y - b.grid.y || a.grid.x - b.grid.x)
    .map((widget) => {
      const item = {
        i: widget.id,
        x: 0,
        y,
        w: 1,
        h: Math.max(widget.grid.h, 2),
        static: true,
      }
      y += item.h
      return item
    })
}

export function PageGrid({
  page,
  render,
}: {
  page: Page
  render: (widget: Widget) => React.ReactNode
}) {
  const { width, containerRef, mounted } = useContainerWidth()
  const layouts = React.useMemo(
    () => ({
      lg: page.widgets.map((w) => ({ i: w.id, ...w.grid, static: true })),
      sm: stackedLayout(page.widgets),
    }),
    [page.widgets]
  )
  return (
    <div ref={containerRef} className="min-w-0">
      {mounted ? (
        <Responsive
          width={width}
          layouts={layouts}
          breakpoints={{ lg: 768, sm: 0 }}
          cols={{ lg: 12, sm: 1 }}
          rowHeight={page.layout.rowHeight}
          margin={[12, 12]}
          containerPadding={[0, 0]}
        >
          {page.widgets.map((widget) => (
            <div key={widget.id}>{render(widget)}</div>
          ))}
        </Responsive>
      ) : null}
    </div>
  )
}

export function AppViewer({
  appId,
  document,
  mode,
  canEdit,
  initialSearch,
}: {
  appId: string
  document: AppDocument
  mode: RuntimeMode
  canEdit: boolean
  initialSearch: Record<string, string | string[] | undefined>
}) {
  const search = React.useMemo(() => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(initialSearch)) {
      if (Array.isArray(value)) value.forEach((v) => params.append(key, v))
      else if (value !== undefined) params.set(key, value)
    }
    return params
  }, [initialSearch])
  const firstPage = document.pages[0]!
  const [pageId, setPageId] = React.useState(
    () =>
      document.pages.find((p) => p.id === search.get("page"))?.id ??
      firstPage.id
  )
  const page = document.pages.find((p) => p.id === pageId) ?? firstPage
  const runtime = useAppRuntime({
    appId,
    document,
    page,
    mode,
    initial: variablesFromSearch(search),
  })

  React.useEffect(() => {
    writeUrl(runtime.variables, page.id, firstPage.id)
  }, [runtime.variables, page.id, firstPage.id])

  const actions: WidgetActions = {
    setVariable: runtime.setVariable,
    runQuery: runtime.runByName,
    navigate: (target) => {
      if (document.pages.some((p) => p.id === target)) setPageId(target)
    },
    exportQuery: (name, format) => {
      const query = document.queries.find((q) => q.name === name)
      if (!query) return
      void downloadExport(appId, {
        queryId: query.id,
        values: runtime.variables,
        mode,
        format,
      }).catch((error) =>
        toast.add({
          title: "Não foi possível exportar",
          description: (error as Error).message,
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

  return (
    <>
      <PageHeader
        title={document.app.name}
        description={
          mode === "draft" ? "Pré-visualização do rascunho" : undefined
        }
        actions={
          <>
            {mode === "draft" ? (
              <Badge variant="warning">rascunho</Badge>
            ) : null}
            {canEdit ? (
              <Link
                href={`/apps/${appId}/edit`}
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                <PencilIcon data-icon="inline-start" />
                Editar
              </Link>
            ) : null}
          </>
        }
      />
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
        {document.app.description ? (
          <Collapsible defaultOpen className="rounded-lg border bg-muted/30">
            <CollapsibleTrigger
              render={
                <Button
                  variant="ghost"
                  className="group/about w-full justify-start"
                />
              }
            >
              <InfoIcon data-icon="inline-start" />
              Sobre esta tela
              <ChevronDownIcon
                data-icon="inline-end"
                className="ml-auto transition-transform group-data-panel-open/about:rotate-180"
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <p className="px-3 pb-3 text-sm whitespace-pre-line text-muted-foreground">
                {document.app.description}
              </p>
            </CollapsibleContent>
          </Collapsible>
        ) : null}

        {document.pages.length > 1 ? (
          <Tabs
            value={page.id}
            onValueChange={(value) => setPageId(String(value))}
          >
            <TabsList className="max-w-full overflow-x-auto">
              {document.pages.map((p) => (
                <TabsTrigger key={p.id} value={p.id}>
                  {p.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}

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
            />
            {runtime.hasManual ? (
              <Button onClick={runtime.runManual}>
                <PlayIcon data-icon="inline-start" />
                Executar
              </Button>
            ) : null}
          </section>
        ) : null}

        {page.widgets.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Esta página ainda não tem componentes.
          </p>
        ) : (
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
                  pages={document.pages}
                />
              </WidgetFrame>
            )}
          />
        )}
      </div>
    </>
  )
}
