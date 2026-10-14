import { z } from "zod"

import { paramDefinitionSchema } from "@/lib/sql-params/types"
import { WIDGET_PROPS, type WidgetType } from "@/lib/widgets/registry"

/**
 * Persisted screen document (PROMPT.md §5). Validated with Zod and versioned
 * by `schemaVersion`; older documents are migrated on load (see migrate.ts).
 */

export const CURRENT_SCHEMA_VERSION = 1

export const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/
const identifier = (what: string) =>
  z
    .string()
    .regex(
      IDENTIFIER,
      `${what}: use letras, números e _ (sem espaços, sem começar com número).`
    )

export const gridSchema = z.object({
  x: z.number().int().min(0).max(11),
  y: z.number().int().min(0).max(10_000),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(200),
})
export type GridPosition = z.infer<typeof gridSchema>

const widgetBase = {
  /** Identifier used in bindings (`{{tabela1.selectedRow}}`). */
  id: identifier("Id do componente"),
  grid: gridSchema,
  /** Property bindings, e.g. `{ data: "{{vendas.data}}" }`. */
  bindings: z.record(z.string(), z.string().max(2000)).default({}),
}

function widgetVariant<T extends WidgetType>(type: T) {
  return z.object({
    ...widgetBase,
    type: z.literal(type),
    props: WIDGET_PROPS[type],
  })
}

export const widgetSchema = z.discriminatedUnion("type", [
  widgetVariant("table"),
  widgetVariant("bar-chart"),
  widgetVariant("line-chart"),
  widgetVariant("area-chart"),
  widgetVariant("pie-chart"),
  widgetVariant("kpi"),
  widgetVariant("text"),
  widgetVariant("text-input"),
  widgetVariant("number-input"),
  widgetVariant("date-input"),
  widgetVariant("date-range"),
  widgetVariant("select"),
  widgetVariant("multi-select"),
  widgetVariant("switch"),
  widgetVariant("button"),
])
export type Widget = z.infer<typeof widgetSchema>

export const appQuerySchema = z.object({
  id: z.string().min(1).max(64),
  /** Name used in bindings: `{{vendas.data}}`. */
  name: identifier("Nome da query"),
  connectionId: z.uuid(),
  sql: z.string().min(1).max(200_000),
  params: z.array(paramDefinitionSchema).max(100).default([]),
  /** auto: runs when a parameter changes; manual: "Executar" button. */
  runMode: z.enum(["auto", "manual"]).default("auto"),
  /** Saved query this one was copied from (library), if any. */
  sourceQueryId: z.uuid().nullable().default(null),
  cacheTtlSeconds: z.number().int().min(0).max(86_400).default(0),
})
export type AppQuery = z.infer<typeof appQuerySchema>

export const pageSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(80),
  layout: z
    .object({
      cols: z.literal(12),
      rowHeight: z.number().int().min(20).max(120),
    })
    .default({ cols: 12, rowHeight: 40 }),
  widgets: z.array(widgetSchema).max(200).default([]),
})
export type Page = z.infer<typeof pageSchema>

export const appMetaSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(4000).default(""),
  tags: z.array(z.string().max(40)).max(20).default([]),
})

export const appDocumentSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    app: appMetaSchema,
    queries: z.array(appQuerySchema).max(50).default([]),
    pages: z.array(pageSchema).min(1).max(30),
  })
  .superRefine((doc, ctx) => {
    const names = new Set<string>()
    for (const [i, query] of doc.queries.entries()) {
      if (names.has(query.name)) {
        ctx.addIssue({
          code: "custom",
          path: ["queries", i, "name"],
          message: `Nome de query repetido: ${query.name}.`,
        })
      }
      names.add(query.name)
    }
    const widgetIds = new Set<string>()
    for (const [p, page] of doc.pages.entries()) {
      for (const [w, widget] of page.widgets.entries()) {
        if (widgetIds.has(widget.id) || names.has(widget.id)) {
          ctx.addIssue({
            code: "custom",
            path: ["pages", p, "widgets", w, "id"],
            message: `Id de componente repetido ou igual ao nome de uma query: ${widget.id}.`,
          })
        }
        widgetIds.add(widget.id)
        if (widget.grid.x + widget.grid.w > 12) {
          ctx.addIssue({
            code: "custom",
            path: ["pages", p, "widgets", w, "grid"],
            message: `O componente ${widget.id} passa da largura da grade (12 colunas).`,
          })
        }
      }
    }
  })
export type AppDocument = z.infer<typeof appDocumentSchema>

export function newDocument(meta: {
  id: string
  name: string
  description?: string
  tags?: string[]
}): AppDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    app: {
      id: meta.id,
      name: meta.name,
      description: meta.description ?? "",
      tags: meta.tags ?? [],
    },
    queries: [],
    pages: [
      {
        id: "p1",
        name: "Página 1",
        layout: { cols: 12, rowHeight: 40 },
        widgets: [],
      },
    ],
  }
}

/** Short random id for pages and queries (not security sensitive). */
export function shortId(prefix: string) {
  return `${prefix}${Math.random().toString(36).slice(2, 8)}`
}

/** Next free identifier like "tabela1", "tabela2"… */
export function nextIdentifier(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  for (let n = 1; ; n++) {
    const candidate = `${base}${n}`
    if (!used.has(candidate)) return candidate
  }
}

export function allIdentifiers(doc: AppDocument): string[] {
  return [
    ...doc.queries.map((q) => q.name),
    ...doc.pages.flatMap((p) => p.widgets.map((w) => w.id)),
  ]
}

export * from "./migrate"
