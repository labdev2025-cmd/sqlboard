"use client"

import { create } from "zustand"

import {
  allIdentifiers,
  nextIdentifier,
  shortId,
  type AppDocument,
  type AppQuery,
  type GridPosition,
  type Page,
  type Widget,
} from "@/lib/app-schema"
import { bottomY, createWidget } from "@/lib/widgets/create"

export { bottomY, createWidget }

const HISTORY_LIMIT = 100

type Selection = { kind: "widget"; id: string } | { kind: "page" } | null

export type BuilderState = {
  doc: AppDocument
  pageId: string
  selection: Selection
  past: AppDocument[]
  future: AppDocument[]
  /** Increments on every change; autosave compares it with the saved revision. */
  revision: number
  init: (doc: AppDocument) => void
  /** Applies a change, recording history unless `history: false`. */
  change: (
    fn: (doc: AppDocument) => AppDocument,
    options?: { history?: boolean }
  ) => void
  /**
   * Replaces the document with a version saved elsewhere (an AI agent, another
   * tab). It is one undo step, and returns the new revision.
   */
  replaceExternal: (doc: AppDocument) => number
  undo: () => void
  redo: () => void
  select: (selection: Selection) => void
  setPage: (pageId: string) => void
}

export const useBuilder = create<BuilderState>((set, get) => ({
  doc: null as unknown as AppDocument,
  pageId: "",
  selection: null,
  past: [],
  future: [],
  revision: 0,
  init: (doc) =>
    set({
      doc,
      pageId: doc.pages[0]!.id,
      selection: null,
      past: [],
      future: [],
      revision: 0,
    }),
  change: (fn, options = {}) => {
    const { doc, past, revision } = get()
    const next = fn(structuredClone(doc))
    if (JSON.stringify(next) === JSON.stringify(doc)) return
    set({
      doc: next,
      past:
        options.history === false ? past : [...past, doc].slice(-HISTORY_LIMIT),
      future: options.history === false ? get().future : [],
      revision: revision + 1,
    })
  },
  replaceExternal: (next) => {
    const { doc, past, revision, pageId, selection } = get()
    const keepsWidget =
      selection?.kind !== "widget" ||
      next.pages.some((p) => p.widgets.some((w) => w.id === selection.id))
    set({
      doc: next,
      past: [...past, doc].slice(-HISTORY_LIMIT),
      future: [],
      revision: revision + 1,
      pageId: next.pages.some((p) => p.id === pageId)
        ? pageId
        : next.pages[0]!.id,
      selection: keepsWidget ? selection : null,
    })
    return revision + 1
  },
  undo: () => {
    const { past, doc, future, revision, pageId } = get()
    const previous = past.at(-1)
    if (!previous) return
    set({
      doc: previous,
      past: past.slice(0, -1),
      future: [doc, ...future],
      revision: revision + 1,
      pageId: previous.pages.some((p) => p.id === pageId)
        ? pageId
        : previous.pages[0]!.id,
    })
  },
  redo: () => {
    const { past, doc, future, revision, pageId } = get()
    const next = future[0]
    if (!next) return
    set({
      doc: next,
      past: [...past, doc],
      future: future.slice(1),
      revision: revision + 1,
      pageId: next.pages.some((p) => p.id === pageId)
        ? pageId
        : next.pages[0]!.id,
    })
  },
  select: (selection) => set({ selection }),
  setPage: (pageId) => set({ pageId, selection: null }),
}))

/* ----------------------------- pure helpers ----------------------------- */

export function currentPage(doc: AppDocument, pageId: string): Page {
  return doc.pages.find((p) => p.id === pageId) ?? doc.pages[0]!
}

export function findWidget(
  doc: AppDocument,
  id: string
): { page: Page; widget: Widget } | null {
  for (const page of doc.pages) {
    const widget = page.widgets.find((w) => w.id === id)
    if (widget) return { page, widget }
  }
  return null
}

export function updateWidgetIn(
  doc: AppDocument,
  id: string,
  fn: (w: Widget) => Widget
): AppDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => ({
      ...page,
      widgets: page.widgets.map((w) => (w.id === id ? fn(w) : w)),
    })),
  }
}

/** Clamps a grid position to the 12-column grid. */
export function clampGrid(
  grid: GridPosition,
  minSize = { w: 1, h: 1 }
): GridPosition {
  const w = Math.min(12, Math.max(minSize.w, Math.round(grid.w)))
  const h = Math.min(200, Math.max(minSize.h, Math.round(grid.h)))
  return {
    w,
    h,
    x: Math.min(12 - w, Math.max(0, Math.round(grid.x))),
    y: Math.max(0, Math.round(grid.y)),
  }
}

/** Renames a query and rewrites `{{old.` bindings to `{{new.`. */
export function renameQueryIn(
  doc: AppDocument,
  oldName: string,
  newName: string
): AppDocument {
  const pattern = new RegExp(`(\\{\\{\\s*)${oldName}(?=[.\\[\\s}])`, "g")
  const rewrite = (value: unknown): unknown =>
    typeof value === "string" ? value.replace(pattern, `$1${newName}`) : value
  return {
    ...doc,
    queries: doc.queries.map((q) =>
      q.name === oldName ? { ...q, name: newName } : q
    ),
    pages: doc.pages.map((page) => ({
      ...page,
      widgets: page.widgets.map(
        (w) =>
          ({
            ...w,
            bindings: Object.fromEntries(
              Object.entries(w.bindings).map(([k, v]) => [
                k,
                rewrite(v) as string,
              ])
            ),
            props: Object.fromEntries(
              Object.entries(w.props).map(([k, v]) => [
                k,
                (k === "optionsQuery" || k === "query") && v === oldName
                  ? newName
                  : rewrite(v),
              ])
            ),
          }) as Widget
      ),
    })),
  }
}

export function newQuery(doc: AppDocument, connectionId: string): AppQuery {
  return {
    id: shortId("q"),
    name: nextIdentifier("consulta", allIdentifiers(doc)),
    connectionId,
    sql: "select 1 as valor",
    params: [],
    runMode: "auto",
    sourceQueryId: null,
    cacheTtlSeconds: 0,
    paramBindings: {},
  }
}
