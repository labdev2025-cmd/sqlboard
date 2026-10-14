import type { Widget } from "@/lib/app-schema"

/** Grid item of react-grid-layout for the stacked (single column) layout. */
export type StackedItem = {
  i: string
  x: number
  y: number
  w: number
  h: number
  static: true
}

/** Reading order for the stacked mobile layout: y, then x. */
export function stackedLayout(widgets: Widget[]): StackedItem[] {
  let y = 0
  return [...widgets]
    .sort((a, b) => a.grid.y - b.grid.y || a.grid.x - b.grid.x)
    .map((widget) => {
      const item: StackedItem = {
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
