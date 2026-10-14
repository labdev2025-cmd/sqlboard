import type { AppQuery, GridPosition, Widget } from "@/lib/app-schema"
import { nextIdentifier } from "@/lib/app-schema"
import {
  isNumericKind,
  isTemporalKind,
  type ResultColumn,
} from "@/lib/data-types"
import { optionsToText } from "@/lib/sql-params/options"
import type { ParamDefinition } from "@/lib/sql-params/types"

import { defaultProps, WIDGET_INFO, type WidgetType } from "./registry"

export type Suggestion = {
  type: WidgetType
  props: Record<string, unknown>
  reason: string
}

const isCategory = (c: ResultColumn) =>
  c.kind === "text" || c.kind === "boolean"

/**
 * Suggests widgets for a query result from the column kinds (PROMPT.md §0.1):
 * one numeric row → KPI; date + number → line; category + number → bar
 * (and pie for few categories); always a table.
 */
export function suggestWidgets(
  columns: ResultColumn[],
  rowCount: number
): Suggestion[] {
  const numeric = columns.filter((c) => isNumericKind(c.kind))
  const temporal = columns.filter((c) => isTemporalKind(c.kind))
  const category = columns.filter(isCategory)
  const suggestions: Suggestion[] = []

  if (rowCount === 1 && numeric.length) {
    for (const column of numeric.slice(0, 4)) {
      suggestions.push({
        type: "kpi",
        props: {
          ...defaultProps("kpi"),
          title: column.name,
          value: column.name,
        },
        reason: `Uma linha com o número “${column.name}”.`,
      })
    }
  }
  if (temporal.length && numeric.length && rowCount > 1) {
    suggestions.push({
      type: "line-chart",
      props: {
        ...defaultProps("line-chart"),
        title: `${numeric[0]!.name} por ${temporal[0]!.name}`,
        x: temporal[0]!.name,
        y: numeric.slice(0, 3).map((c) => c.name),
      },
      reason: `Data (“${temporal[0]!.name}”) e número: evolução no tempo.`,
    })
  }
  if (category.length && numeric.length && rowCount > 1) {
    suggestions.push({
      type: "bar-chart",
      props: {
        ...defaultProps("bar-chart"),
        title: `${numeric[0]!.name} por ${category[0]!.name}`,
        x: category[0]!.name,
        y: numeric.slice(0, 2).map((c) => c.name),
      },
      reason: `Categoria (“${category[0]!.name}”) e número: comparação.`,
    })
    if (rowCount <= 8) {
      suggestions.push({
        type: "pie-chart",
        props: {
          ...defaultProps("pie-chart"),
          title: `Participação por ${category[0]!.name}`,
          label: category[0]!.name,
          value: numeric[0]!.name,
        },
        reason: "Poucas categorias: participação de cada uma.",
      })
    }
  }
  suggestions.push({
    type: "table",
    props: { ...defaultProps("table") },
    reason: "Todas as colunas, com busca e ordenação.",
  })
  return suggestions
}

const INPUT_FOR: Record<ParamDefinition["type"], WidgetType> = {
  text: "text-input",
  number: "number-input",
  integer: "number-input",
  date: "date-input",
  datetime: "text-input",
  boolean: "switch",
  list: "select",
  multi: "multi-select",
}

/** Input widget for a query parameter. */
export function inputForParam(param: ParamDefinition): {
  type: WidgetType
  props: Record<string, unknown>
} {
  const type = INPUT_FOR[param.type]
  const props: Record<string, unknown> = {
    ...defaultProps(type),
    label: param.label || param.name,
    param: param.name,
  }
  if ((type === "select" || type === "multi-select") && param.options?.length) {
    props.options = optionsToText(param.options)
  }
  return { type, props }
}

/** Packs widgets left-to-right in rows of 12 columns, starting at `startY`. */
export function packWidgets(
  items: {
    type: WidgetType
    props: Record<string, unknown>
    w?: number
    h?: number
  }[],
  startY: number,
  taken: Iterable<string>,
  dataBinding?: string
): Widget[] {
  const used = new Set(taken)
  let x = 0
  let y = startY
  let rowHeight = 0
  return items.map((item) => {
    const info = WIDGET_INFO[item.type]
    const w = Math.min(12, item.w ?? info.size.w)
    const h = item.h ?? info.size.h
    if (x + w > 12) {
      x = 0
      y += rowHeight
      rowHeight = 0
    }
    const grid: GridPosition = { x, y, w, h }
    x += w
    rowHeight = Math.max(rowHeight, h)
    const id = nextIdentifier(baseName(item.type), used)
    used.add(id)
    return {
      id,
      type: item.type,
      grid,
      props: item.props,
      bindings: info.usesData && dataBinding ? { data: dataBinding } : {},
    } as Widget
  })
}

function baseName(type: WidgetType) {
  const names: Record<WidgetType, string> = {
    table: "tabela",
    "bar-chart": "barras",
    "line-chart": "linha",
    "area-chart": "area",
    "pie-chart": "pizza",
    kpi: "kpi",
    text: "texto",
    "text-input": "campo",
    "number-input": "numero",
    "date-input": "data",
    "date-range": "periodo",
    select: "selecao",
    "multi-select": "selecao_multipla",
    switch: "chave",
    button: "botao",
  }
  return names[type]
}

export { baseName as widgetBaseName }

/**
 * "Gerar tela automática": inputs for the parameters, then KPIs, the best
 * chart and a table bound to the query.
 */
export function generateScreen(
  query: AppQuery,
  columns: ResultColumn[],
  rowCount: number,
  options: {
    startY?: number
    taken?: Iterable<string>
    existingVariables?: Iterable<string>
  } = {}
): Widget[] {
  const already = new Set(options.existingVariables ?? [])
  const inputs = query.params
    .filter((p) => !already.has(p.name))
    .map(inputForParam)
  const suggestions = suggestWidgets(columns, rowCount)
  const kpis = suggestions.filter((s) => s.type === "kpi")
  const chart = suggestions.find(
    (s) => s.type === "line-chart" || s.type === "bar-chart"
  )
  const pie = suggestions.find((s) => s.type === "pie-chart")
  const items: {
    type: WidgetType
    props: Record<string, unknown>
    w?: number
    h?: number
  }[] = [
    ...inputs,
    ...kpis.map((s) => ({
      ...s,
      w: Math.max(3, Math.floor(12 / Math.max(kpis.length, 1))),
    })),
  ]
  if (chart) items.push({ ...chart, w: pie ? 8 : 12 })
  if (pie) items.push({ ...pie, w: chart ? 4 : 6 })
  if (!kpis.length || rowCount > 1)
    items.push({ type: "table", props: suggestions.at(-1)!.props, w: 12 })
  return packWidgets(
    items,
    options.startY ?? 0,
    options.taken ?? [],
    `{{${query.name}.data}}`
  )
}
