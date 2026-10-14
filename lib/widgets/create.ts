import {
  allIdentifiers,
  nextIdentifier,
  type AppDocument,
  type GridPosition,
  type Page,
  type Widget,
} from "@/lib/app-schema"
import {
  defaultProps,
  WIDGET_INFO,
  type WidgetType,
} from "@/lib/widgets/registry"
import { widgetBaseName } from "@/lib/widgets/suggest"

/** First free row below the existing widgets. */
export function bottomY(page: Page) {
  return page.widgets.reduce((max, w) => Math.max(max, w.grid.y + w.grid.h), 0)
}

export function createWidget(
  doc: AppDocument,
  page: Page,
  type: WidgetType,
  position?: Partial<GridPosition>,
  dataQuery?: string
): Widget {
  const info = WIDGET_INFO[type]
  const id = nextIdentifier(widgetBaseName(type), allIdentifiers(doc))
  const w = Math.min(12, position?.w ?? info.size.w)
  return {
    id,
    type,
    grid: {
      x: Math.min(Math.max(0, position?.x ?? 0), 12 - w),
      y: position?.y ?? bottomY(page),
      w,
      h: position?.h ?? info.size.h,
    },
    props: defaultProps(type),
    bindings:
      info.usesData && dataQuery ? { data: `{{${dataQuery}.data}}` } : {},
  } as Widget
}
