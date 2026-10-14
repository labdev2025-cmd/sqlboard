"use client"

import {
  AreaChartIcon,
  BarChart3Icon,
  CalendarIcon,
  CalendarRangeIcon,
  GaugeIcon,
  HashIcon,
  LineChartIcon,
  ListChecksIcon,
  ListIcon,
  MousePointerClickIcon,
  PieChartIcon,
  TableIcon,
  TextCursorInputIcon,
  ToggleRightIcon,
  TypeIcon,
  type LucideIcon,
} from "lucide-react"

import {
  CATEGORY_LABELS,
  WIDGET_INFO,
  WIDGET_TYPES,
  type WidgetCategory,
  type WidgetType,
} from "@/lib/widgets/registry"

import { dragState, PALETTE_MIME } from "./canvas"

export const WIDGET_ICONS: Record<WidgetType, LucideIcon> = {
  table: TableIcon,
  "bar-chart": BarChart3Icon,
  "line-chart": LineChartIcon,
  "area-chart": AreaChartIcon,
  "pie-chart": PieChartIcon,
  kpi: GaugeIcon,
  text: TypeIcon,
  "text-input": TextCursorInputIcon,
  "number-input": HashIcon,
  "date-input": CalendarIcon,
  "date-range": CalendarRangeIcon,
  select: ListIcon,
  "multi-select": ListChecksIcon,
  switch: ToggleRightIcon,
  button: MousePointerClickIcon,
}

const ORDER: WidgetCategory[] = ["data", "chart", "input", "content"]

/** Widget palette: click/Enter adds at the end; drag drops at a grid position. */
export function Palette({ onAdd }: { onAdd: (type: WidgetType) => void }) {
  return (
    <nav aria-label="Paleta de componentes" className="flex flex-col gap-4">
      {ORDER.map((category) => (
        <section key={category} className="flex flex-col gap-1">
          <h3 className="px-1 text-xs font-medium text-muted-foreground">
            {CATEGORY_LABELS[category]}
          </h3>
          <ul className="grid grid-cols-2 gap-1.5">
            {WIDGET_TYPES.filter(
              (type) => WIDGET_INFO[type].category === category
            ).map((type) => {
              const Icon = WIDGET_ICONS[type]
              return (
                <li key={type}>
                  <button
                    type="button"
                    draggable
                    unselectable="on"
                    onDragStart={(event) => {
                      dragState.type = type
                      event.dataTransfer.setData(PALETTE_MIME, type)
                      event.dataTransfer.setData("text/plain", "")
                      event.dataTransfer.effectAllowed = "copy"
                    }}
                    onDragEnd={() => {
                      dragState.type = null
                    }}
                    onClick={() => onAdd(type)}
                    title={WIDGET_INFO[type].description}
                    aria-label={`Adicionar ${WIDGET_INFO[type].label}`}
                    className="flex min-h-11 w-full cursor-grab flex-col items-center justify-center gap-1 rounded-lg border bg-background p-2 text-center text-xs transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
                  >
                    <Icon
                      className="size-4 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="leading-tight">
                      {WIDGET_INFO[type].label}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </nav>
  )
}
