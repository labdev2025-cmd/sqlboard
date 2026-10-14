"use client"

import * as React from "react"
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  DownloadIcon,
  PlayIcon,
} from "lucide-react"
import ReactMarkdown from "react-markdown"

import { ResultTable } from "@/components/data/result-table"
import { ParamInput } from "@/components/params/param-inputs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldLabel } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import type { Widget } from "@/lib/app-schema"
import { evaluateBinding, type BindingScope } from "@/lib/bindings"
import type { Cell } from "@/lib/data-types"
import { formatCell, toNumber } from "@/lib/format"
import { textToOptions } from "@/lib/sql-params/options"
import type {
  ParamDefinition,
  ParamOption,
  RawParamValue,
  RawParamValues,
} from "@/lib/sql-params/types"
import { cn } from "@/lib/utils"
import { WIDGET_INFO } from "@/lib/widgets/registry"

import {
  CartesianChartWidget,
  MissingConfig,
  PieChartWidget,
} from "./chart-widgets"
import { resolveDataset, type Dataset } from "./dataset"

export type WidgetActions = {
  setVariable: (name: string, value: RawParamValue) => void
  runQuery: (name: string) => void
  exportQuery: (name: string, format: "csv" | "xlsx") => void
  navigate: (pageId: string) => void
  /** Row click on tables/charts (bindings: {{widget.selectedRow}}). */
  selectRow?: (widget: Widget, row: Record<string, Cell>, index: number) => void
}

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})
const pct = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
})
const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 })

function formatKpi(value: number | null, format: string) {
  if (value === null) return "—"
  if (format === "currency") return brl.format(value)
  if (format === "percent") return pct.format(value)
  return num.format(value)
}

function text(value: unknown, scope: BindingScope) {
  return typeof value === "string"
    ? String(evaluateBinding(value, scope) ?? "")
    : ""
}

function DataState({
  dataset,
  children,
}: {
  dataset: Dataset | null
  children: React.ReactNode
}) {
  if (!dataset)
    return (
      <MissingConfig>
        Escolha a fonte de dados (uma query da tela).
      </MissingConfig>
    )
  if (dataset.error) {
    return (
      <Alert variant="destructive" className="m-1">
        <AlertDescription>{dataset.error}</AlertDescription>
      </Alert>
    )
  }
  if (dataset.loading && !dataset.rows.length) {
    return (
      <div className="flex h-full flex-col gap-2 p-1" aria-busy="true">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="w-full flex-1" />
      </div>
    )
  }
  if (!dataset.columns.length) {
    return (
      <MissingConfig>
        {dataset.missing.length
          ? `Preencha: ${dataset.missing.join(", ")}.`
          : dataset.source
            ? "Aguardando a execução."
            : "Sem dados."}
      </MissingConfig>
    )
  }
  if (dataset.truncated) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-1">
        <div className="min-h-0 flex-1">{children}</div>
        <p className="shrink-0 text-xs text-muted-foreground">
          Mostrando {dataset.rows.length.toLocaleString("pt-BR")} linhas; o
          resultado tem mais (limite da conexão). Refine os filtros.
        </p>
      </div>
    )
  }
  return <>{children}</>
}

function optionsFor(widget: Widget, scope: BindingScope): ParamOption[] {
  const props = widget.props as Record<string, string>
  if (props.optionsQuery) {
    const source = scope[props.optionsQuery] as
      | { data?: Record<string, Cell>[]; columns?: { name: string }[] }
      | undefined
    const column = props.optionsColumn || source?.columns?.[0]?.name
    if (source?.data && column) {
      const seen = new Set<string>()
      return source.data
        .map((row) => String(row[column] ?? ""))
        .filter((value) => value !== "" && !seen.has(value) && seen.add(value))
        .map((value) => ({ value }))
    }
    return []
  }
  return textToOptions(props.options ?? "")
}

/** Renders one widget's content (frame and title are added by the caller). */
export function WidgetContent({
  widget,
  scope,
  variables,
  actions,
  selectedIndex,
  pages,
}: {
  widget: Widget
  scope: BindingScope
  variables: RawParamValues
  actions: WidgetActions
  selectedIndex?: number | null
  pages?: { id: string; name: string }[]
}) {
  const dataset = WIDGET_INFO[widget.type].usesData
    ? resolveDataset(widget.bindings?.data, scope)
    : null
  const title = "title" in widget.props ? text(widget.props.title, scope) : ""
  const select = (row: Cell[], index: number) => {
    if (!actions.selectRow || !dataset) return
    actions.selectRow(
      widget,
      Object.fromEntries(
        dataset.columns.map((c, i) => [c.name, row[i] ?? null])
      ),
      index
    )
  }

  switch (widget.type) {
    case "table":
      return (
        <DataState dataset={dataset}>
          <ResultTable
            label={title || widget.id}
            columns={dataset!.columns}
            rows={dataset!.rows}
            pageSize={widget.props.pageSize}
            searchable={widget.props.searchable}
            visibleColumns={widget.props.columns}
            onRowActivate={actions.selectRow ? select : undefined}
            selectedIndex={selectedIndex}
          />
        </DataState>
      )
    case "bar-chart":
    case "line-chart":
    case "area-chart":
      return (
        <DataState dataset={dataset}>
          <CartesianChartWidget
            kind={
              widget.type === "bar-chart"
                ? "bar"
                : widget.type === "line-chart"
                  ? "line"
                  : "area"
            }
            dataset={dataset!}
            x={widget.props.x}
            y={widget.props.y}
            stacked={"stacked" in widget.props ? widget.props.stacked : false}
            horizontal={
              "horizontal" in widget.props ? widget.props.horizontal : false
            }
            label={title || widget.id}
            onSelect={actions.selectRow ? select : undefined}
          />
        </DataState>
      )
    case "pie-chart":
      return (
        <DataState dataset={dataset}>
          <PieChartWidget
            dataset={dataset!}
            labelColumn={widget.props.label}
            valueColumn={widget.props.value}
            donut={widget.props.donut}
            label={title || widget.id}
            onSelect={actions.selectRow ? select : undefined}
          />
        </DataState>
      )
    case "kpi": {
      return (
        <DataState dataset={dataset}>
          {(() => {
            const vi = dataset!.columns.findIndex(
              (c) => c.name === widget.props.value
            )
            if (vi < 0)
              return <MissingConfig>Escolha a coluna do valor.</MissingConfig>
            const row = dataset!.rows[0] ?? []
            const value = toNumber(row[vi] ?? null)
            const ci = widget.props.compare
              ? dataset!.columns.findIndex(
                  (c) => c.name === widget.props.compare
                )
              : -1
            const previous = ci >= 0 ? toNumber(row[ci] ?? null) : null
            const change =
              value !== null && previous
                ? (value - previous) / Math.abs(previous)
                : null
            return (
              <div className="flex h-full flex-col justify-center gap-1">
                <p className="truncate text-3xl font-semibold tabular-nums">
                  {value === null && row[vi] != null
                    ? formatCell(row[vi]!, "text")
                    : formatKpi(value, widget.props.format)}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {change !== null ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 font-medium",
                        change >= 0 ? "text-success" : "text-destructive"
                      )}
                    >
                      {change >= 0 ? (
                        <ArrowUpRightIcon className="size-4" aria-hidden />
                      ) : (
                        <ArrowDownRightIcon className="size-4" aria-hidden />
                      )}
                      {pct.format(change)}
                      <span className="sr-only">
                        {change >= 0 ? "de aumento" : "de queda"}
                      </span>
                    </span>
                  ) : null}
                  {widget.props.description ? (
                    <span className="truncate">
                      {text(widget.props.description, scope)}
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })()}
        </DataState>
      )
    }
    case "text":
      return (
        <div className="prose-sm h-full overflow-auto text-sm leading-relaxed [&_a]:underline [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mb-2 [&_ul]:list-disc">
          <ReactMarkdown skipHtml>
            {text(widget.props.content, scope)}
          </ReactMarkdown>
        </div>
      )
    case "text-input":
    case "number-input":
    case "date-input":
    case "select":
    case "multi-select": {
      const typeMap: Record<string, ParamDefinition["type"]> = {
        "text-input": "text",
        "number-input": "number",
        "date-input": "date",
        select: "list",
        "multi-select": "multi",
      }
      const param: ParamDefinition = {
        name: widget.props.param,
        type: typeMap[widget.type]!,
        label: widget.props.label || widget.props.param,
        required: false,
      }
      const options =
        widget.type === "select" || widget.type === "multi-select"
          ? optionsFor(widget, scope)
          : undefined
      return (
        <ParamInput
          param={param}
          value={variables[param.name]}
          options={options}
          onChange={(value) => actions.setVariable(param.name, value)}
          idPrefix={widget.id}
        />
      )
    }
    case "date-range":
      return (
        <div className="grid gap-2 @xs:grid-cols-2">
          {(["paramStart", "paramEnd"] as const).map((key, i) => (
            <ParamInput
              key={key}
              param={{
                name: widget.props[key],
                type: "date",
                label: `${widget.props.label || "Período"} — ${i === 0 ? "início" : "fim"}`,
                required: false,
              }}
              value={variables[widget.props[key]]}
              onChange={(value) =>
                actions.setVariable(widget.props[key], value)
              }
              idPrefix={widget.id}
            />
          ))}
        </div>
      )
    case "switch": {
      const value = variables[widget.props.param]
      const checked = value === true || value === "true"
      return (
        <Field orientation="horizontal" className="h-full items-center">
          <Switch
            id={`${widget.id}-switch`}
            checked={checked}
            onCheckedChange={(next) =>
              actions.setVariable(widget.props.param, next ? "true" : "false")
            }
          />
          <FieldLabel htmlFor={`${widget.id}-switch`}>
            {widget.props.label || widget.props.param}
          </FieldLabel>
        </Field>
      )
    }
    case "button": {
      const { action, query, format, page } = widget.props
      const disabled = action === "navigate" ? !page : !query
      const pageName = pages?.find((p) => p.id === page)?.name
      return (
        <div className="flex h-full items-center">
          <Button
            className="w-full"
            disabled={disabled}
            onClick={() => {
              if (action === "run") actions.runQuery(query)
              else if (action === "export") actions.exportQuery(query, format)
              else actions.navigate(page)
            }}
          >
            {action === "run" ? (
              <PlayIcon data-icon="inline-start" />
            ) : action === "export" ? (
              <DownloadIcon data-icon="inline-start" />
            ) : null}
            {widget.props.label ||
              (action === "navigate"
                ? `Ir para ${pageName ?? "página"}`
                : "Executar")}
          </Button>
        </div>
      )
    }
  }
}

/** Card-like frame with title, used by the viewer and the builder canvas. */
export function WidgetFrame({
  widget,
  scope,
  className,
  children,
  toolbar,
}: {
  widget: Widget
  scope: BindingScope
  className?: string
  children: React.ReactNode
  toolbar?: React.ReactNode
}) {
  const title = "title" in widget.props ? text(widget.props.title, scope) : ""
  const isInput =
    WIDGET_INFO[widget.type].category === "input" || widget.type === "button"
  return (
    <section
      aria-label={title || WIDGET_INFO[widget.type].label}
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col gap-2 overflow-hidden rounded-xl bg-card p-3 text-card-foreground ring-1 ring-foreground/10",
        isInput && "justify-center",
        className
      )}
    >
      {title || toolbar ? (
        <header className="flex min-w-0 items-center gap-2">
          {title ? (
            <h2 className="truncate text-sm font-medium">{title}</h2>
          ) : null}
          {toolbar ? (
            <div className="ml-auto flex items-center gap-1">{toolbar}</div>
          ) : null}
        </header>
      ) : null}
      <div className="@container min-h-0 flex-1">{children}</div>
    </section>
  )
}

/** "Exportar" menu for widgets bound to a query (`{{q.data}}`). */
export function ExportMenu({
  widget,
  scope,
  onExport,
}: {
  widget: Widget
  scope: BindingScope
  onExport: (query: string, format: "csv" | "xlsx") => void
}) {
  const source = /^\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\.data\s*\}\}$/.exec(
    widget.bindings?.data ?? ""
  )?.[1]
  if (!source || !WIDGET_INFO[widget.type].usesData) return null
  const title = "title" in widget.props ? text(widget.props.title, scope) : ""
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Exportar dados de ${title || WIDGET_INFO[widget.type].label}`}
          />
        }
      >
        <DownloadIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onExport(source, "csv")}>
            Exportar CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport(source, "xlsx")}>
            Exportar Excel (XLSX)
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
