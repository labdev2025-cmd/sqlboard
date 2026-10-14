"use client"

import * as React from "react"
import { GripVerticalIcon } from "lucide-react"
import ReactGridLayout, {
  useContainerWidth,
  verticalCompactor,
  type Layout,
  type LayoutItem,
} from "react-grid-layout"

import "react-grid-layout/css/styles.css"

import {
  WidgetContent,
  type WidgetActions,
} from "@/components/widgets/widget-view"
import type { Page, Widget } from "@/lib/app-schema"
import { cn } from "@/lib/utils"
import { WIDGET_INFO, type WidgetType } from "@/lib/widgets/registry"

import type { AppRuntime } from "../app-runtime/use-app-runtime"

export const PALETTE_MIME = "application/x-sqlboard-widget"

/** Shared between the palette and the canvas while dragging. */
export const dragState: { type: WidgetType | null } = { type: null }

export function Canvas({
  page,
  runtime,
  actions,
  selectedId,
  onSelect,
  onLayout,
  onDropWidget,
  onKeyboard,
}: {
  page: Page
  runtime: AppRuntime
  actions: WidgetActions
  selectedId: string | null
  onSelect: (id: string | null) => void
  onLayout: (layout: Layout) => void
  onDropWidget: (type: WidgetType, item: { x: number; y: number }) => void
  onKeyboard: (widget: Widget, event: React.KeyboardEvent) => void
}) {
  const { width, containerRef, mounted } = useContainerWidth()
  const layout = React.useMemo<LayoutItem[]>(
    () =>
      page.widgets.map((w) => ({
        i: w.id,
        ...w.grid,
        minW: WIDGET_INFO[w.type].minSize.w,
        minH: WIDGET_INFO[w.type].minSize.h,
      })),
    [page.widgets]
  )
  const draggingInfo = dragState.type ? WIDGET_INFO[dragState.type] : null

  return (
    <div
      ref={containerRef}
      className="relative min-h-[60svh] min-w-0 rounded-xl border border-dashed bg-muted/20 p-2"
      onClick={(event) => {
        if (event.target === event.currentTarget) onSelect(null)
      }}
    >
      {page.widgets.length === 0 ? (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Arraste um componente da paleta para cá, ou clique nele para
          adicionar.
        </p>
      ) : null}
      {mounted ? (
        <ReactGridLayout
          width={Math.max(width - 16, 280)}
          layout={layout}
          gridConfig={{
            cols: 12,
            rowHeight: page.layout.rowHeight,
            margin: [12, 12],
            containerPadding: [0, 0],
          }}
          dragConfig={{
            enabled: true,
            handle: ".widget-drag-handle",
            threshold: 3,
          }}
          resizeConfig={{ enabled: true, handles: ["se", "e", "s"] }}
          dropConfig={{
            enabled: true,
            defaultItem: {
              w: draggingInfo?.size.w ?? 4,
              h: draggingInfo?.size.h ?? 4,
            },
          }}
          compactor={verticalCompactor}
          onLayoutChange={onLayout}
          onDrop={(_layout, item) => {
            const type = dragState.type
            dragState.type = null
            if (type && item) onDropWidget(type, { x: item.x, y: item.y })
          }}
          className="min-h-[55svh]"
        >
          {page.widgets.map((widget) => {
            const selected = widget.id === selectedId
            const info = WIDGET_INFO[widget.type]
            return (
              <div
                key={widget.id}
                role="group"
                tabIndex={0}
                aria-label={`${info.label} ${widget.id}. Setas movem, Shift+setas redimensionam, Delete remove.`}
                aria-current={selected ? "true" : undefined}
                data-widget-id={widget.id}
                onFocus={(event) => {
                  if (event.target === event.currentTarget) onSelect(widget.id)
                }}
                onMouseDown={() => onSelect(widget.id)}
                onKeyDown={(event) => {
                  if (event.target === event.currentTarget)
                    onKeyboard(widget, event)
                }}
                className={cn(
                  "flex flex-col overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10 outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
                  selected && "ring-2 ring-primary"
                )}
              >
                <div className="widget-drag-handle flex h-7 shrink-0 cursor-grab items-center gap-1 border-b bg-muted/40 px-2 text-xs text-muted-foreground active:cursor-grabbing">
                  <GripVerticalIcon className="size-3.5" aria-hidden />
                  <span className="truncate font-mono">{widget.id}</span>
                  <span className="ml-auto truncate">{info.label}</span>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden p-3">
                  {"title" in widget.props && widget.props.title ? (
                    <h2 className="mb-2 truncate text-sm font-medium">
                      {String(widget.props.title)}
                    </h2>
                  ) : null}
                  <WidgetContent
                    widget={widget}
                    scope={runtime.scope}
                    variables={runtime.variables}
                    actions={actions}
                    selectedIndex={
                      runtime.widgetStates[widget.id]?.selectedIndex
                    }
                  />
                </div>
              </div>
            )
          })}
        </ReactGridLayout>
      ) : null}
    </div>
  )
}
