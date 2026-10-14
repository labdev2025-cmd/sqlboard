"use client"

import * as React from "react"

import type { AppDocument, AppQuery, Page, Widget } from "@/lib/app-schema"
import { api, ApiError } from "@/lib/api-client"
import {
  bindingRoots,
  evaluateBinding,
  type BindingScope,
} from "@/lib/bindings"
import type { Cell, QueryResult, ResultColumn } from "@/lib/data-types"
import { isEmptyValue } from "@/lib/sql-params/compile"
import type { RawParamValue, RawParamValues } from "@/lib/sql-params/types"
import { widgetVariables } from "@/lib/widgets/registry"

export type QueryState =
  | { status: "idle" }
  | { status: "waiting"; missing: string[] }
  | { status: "loading"; previous?: QueryResult }
  | { status: "success"; result: QueryResult & { cached?: boolean } }
  | { status: "error"; message: string }

export type RuntimeMode = "draft" | "published"

export type QueryRunner = (
  query: AppQuery,
  values: RawParamValues,
  signal: AbortSignal
) => Promise<QueryResult & { cached?: boolean }>

export type WidgetState = {
  selectedRow?: Record<string, Cell> | null
  selectedIndex?: number | null
}

/** Rows as objects keyed by column name (for bindings and charts). */
export function rowsToObjects(columns: ResultColumn[], rows: Cell[][]) {
  return rows.map((row) =>
    Object.fromEntries(columns.map((c, i) => [c.name, row[i] ?? null]))
  )
}

/** Initial variable values: parameter defaults, then the URL (deep link). */
export function initialVariables(
  document: AppDocument,
  fromUrl: RawParamValues = {}
): RawParamValues {
  const values: RawParamValues = {}
  for (const query of document.queries) {
    for (const param of query.params) {
      if (
        values[param.name] === undefined &&
        param.default !== undefined &&
        param.default !== null
      ) {
        values[param.name] = param.default
      }
    }
  }
  return { ...values, ...fromUrl }
}

/** Queries referenced by the widgets of a page (data bindings and option lists). */
export function queriesUsedBy(page: Page, document: AppDocument): AppQuery[] {
  const names = new Set<string>()
  for (const widget of page.widgets) {
    for (const template of Object.values(widget.bindings ?? {})) {
      for (const root of bindingRoots(template)) names.add(root)
    }
    const props = widget.props as Record<string, unknown>
    if (typeof props.optionsQuery === "string" && props.optionsQuery)
      names.add(props.optionsQuery)
    if (
      widget.type === "button" &&
      typeof props.query === "string" &&
      props.query
    )
      names.add(props.query)
    for (const value of Object.values(props)) {
      if (typeof value === "string")
        for (const root of bindingRoots(value)) names.add(root)
    }
  }
  // Queries feeding the parameters of used queries (bindings and option lists).
  for (let depth = 0; depth < 3; depth++) {
    for (const query of document.queries.filter((q) => names.has(q.name))) {
      for (const template of Object.values(query.paramBindings ?? {})) {
        for (const root of bindingRoots(template)) names.add(root)
      }
      for (const param of query.params) {
        const source = document.queries.find(
          (q) => q.id === param.optionsQuery?.queryId
        )
        if (source) names.add(source.name)
      }
    }
  }
  return document.queries.filter((q) => names.has(q.name))
}

/** Converts a binding result into a parameter value (never code, only data). */
function toRawValue(value: unknown): RawParamValue {
  if (value === undefined || value === null) return null
  if (Array.isArray(value))
    return value.filter((v) => v !== null && v !== undefined).map(String)
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "string"
  )
    return value
  return JSON.stringify(value)
}

/**
 * Parameter values of a query: a binding (`paramBindings`, v2) wins over the
 * variable with the same name (filters, URL).
 */
export function resolveParams(
  query: AppQuery,
  variables: RawParamValues,
  scope: BindingScope
): RawParamValues {
  return Object.fromEntries(
    query.params.map((p) => {
      const template = query.paramBindings?.[p.name]?.trim()
      return [
        p.name,
        template
          ? toRawValue(evaluateBinding(template, scope))
          : (variables[p.name] ?? null),
      ]
    })
  )
}

function missingRequired(query: AppQuery, variables: RawParamValues) {
  return query.params
    .filter(
      (p) => p.required && isEmptyValue(variables[p.name] as RawParamValue)
    )
    .map((p) => p.label || p.name)
}

/**
 * Screen runtime: variables (parameter values), query states, widget states
 * and the binding scope. Auto queries re-run when their parameter values
 * change; manual ones wait for "Executar".
 */
export function useAppRuntime({
  appId,
  document,
  page,
  mode,
  initial,
  runner,
}: {
  appId: string
  document: AppDocument
  page: Page
  mode: RuntimeMode
  initial?: RawParamValues
  /** Custom executor (the builder runs the local draft SQL). */
  runner?: QueryRunner
}) {
  const [variables, setVariables] = React.useState<RawParamValues>(() =>
    initialVariables(document, initial)
  )
  const [states, setStates] = React.useState<Record<string, QueryState>>({})
  const [widgetStates, setWidgetStates] = React.useState<
    Record<string, WidgetState>
  >({})
  const controllers = React.useRef(new Map<string, AbortController>())
  const lastKeys = React.useRef(new Map<string, string>())

  const used = React.useMemo(
    () => queriesUsedBy(page, document),
    [page, document]
  )

  const run = React.useCallback(
    async (query: AppQuery, values: RawParamValues) => {
      const missing = missingRequired(query, values)
      if (missing.length) {
        setStates((s) => ({ ...s, [query.id]: { status: "waiting", missing } }))
        return
      }
      controllers.current.get(query.id)?.abort()
      const controller = new AbortController()
      controllers.current.set(query.id, controller)
      setStates((s) => {
        const prev = s[query.id]
        return {
          ...s,
          [query.id]: {
            status: "loading",
            previous: prev?.status === "success" ? prev.result : undefined,
          },
        }
      })
      try {
        const result = runner
          ? await runner(query, values, controller.signal)
          : await api<QueryResult & { cached?: boolean }>(
              `/api/apps/${appId}/run`,
              {
                method: "POST",
                body: {
                  queryId: query.id,
                  values,
                  mode,
                },
                signal: controller.signal,
              }
            )
        if (controllers.current.get(query.id) === controller) {
          setStates((s) => ({
            ...s,
            [query.id]: { status: "success", result },
          }))
        }
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return
        if (controllers.current.get(query.id) !== controller) return
        setStates((s) => ({
          ...s,
          [query.id]: {
            status: "error",
            message:
              error instanceof ApiError
                ? error.message
                : "Falha ao executar a query.",
          },
        }))
      }
    },
    [appId, mode, runner]
  )

  const scope = React.useMemo<BindingScope>(() => {
    const result: BindingScope = { vars: variables }
    for (const query of document.queries) {
      const state = states[query.id]
      const data =
        state?.status === "success"
          ? state.result
          : state?.status === "loading"
            ? state.previous
            : undefined
      result[query.name] = {
        data: data ? rowsToObjects(data.columns, data.rows) : [],
        columns: data?.columns ?? [],
        rows: data?.rows ?? [],
        rowCount: data?.rowCount ?? 0,
        truncated: data?.truncated ?? false,
        loading: state?.status === "loading",
        error: state?.status === "error" ? state.message : null,
        missing: state?.status === "waiting" ? state.missing : [],
      }
    }
    for (const p of document.pages) {
      for (const widget of p.widgets) {
        const vars = widgetVariables(widget)
        result[widget.id] = {
          value:
            vars.length === 1
              ? (variables[vars[0]!] ?? null)
              : vars.map((v) => variables[v] ?? null),
          selectedRow: widgetStates[widget.id]?.selectedRow ?? null,
        }
      }
    }
    return result
  }, [variables, states, widgetStates, document])

  // Auto-run used queries when their parameter values change (debounced).
  React.useEffect(() => {
    const timer = setTimeout(() => {
      for (const query of used) {
        if (query.runMode !== "auto") continue
        const values = resolveParams(query, variables, scope)
        const key = JSON.stringify([query.sql, values])
        if (lastKeys.current.get(query.id) === key) continue
        lastKeys.current.set(query.id, key)
        void run(query, values)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [used, variables, scope, run])

  React.useEffect(() => {
    const all = controllers.current
    return () => all.forEach((controller) => controller.abort())
  }, [])

  const runByName = React.useCallback(
    (name: string) => {
      const query = document.queries.find((q) => q.name === name)
      if (query) {
        const values = resolveParams(query, variables, scope)
        lastKeys.current.set(query.id, JSON.stringify([query.sql, values]))
        void run(query, values)
      }
    },
    [document.queries, run, variables, scope]
  )

  const runManual = React.useCallback(() => {
    for (const query of used) {
      const values = resolveParams(query, variables, scope)
      lastKeys.current.set(query.id, JSON.stringify([query.sql, values]))
      void run(query, values)
    }
  }, [used, run, variables, scope])

  const setVariable = React.useCallback(
    (name: string, value: RawParamValue) => {
      setVariables((prev) => ({ ...prev, [name]: value }))
    },
    []
  )

  const setWidgetState = React.useCallback((id: string, state: WidgetState) => {
    setWidgetStates((prev) => ({ ...prev, [id]: { ...prev[id], ...state } }))
  }, [])

  /** Variables used by queries of this page but not set by any input widget. */
  const freeParams = React.useMemo(() => {
    const controlled = new Set(
      page.widgets.flatMap((w: Widget) => widgetVariables(w))
    )
    const seen = new Map<string, AppQuery["params"][number]>()
    for (const query of used) {
      for (const param of query.params) {
        if (query.paramBindings?.[param.name]?.trim()) continue
        if (!controlled.has(param.name) && !seen.has(param.name))
          seen.set(param.name, param)
      }
    }
    return [...seen.values()]
  }, [page.widgets, used])

  /** Options of a list/multi parameter that come from another query. */
  const paramOptions = React.useCallback(
    (param: AppQuery["params"][number]) => {
      const source = document.queries.find(
        (q) => q.id === param.optionsQuery?.queryId
      )
      if (!source || !param.optionsQuery) return undefined
      const data =
        (scope[source.name] as { data?: Record<string, unknown>[] } | undefined)
          ?.data ?? []
      const seen = new Set<string>()
      const options: { value: string; label?: string }[] = []
      for (const row of data) {
        const value = row[param.optionsQuery.valueColumn]
        if (value === null || value === undefined) continue
        const key = String(value)
        if (seen.has(key)) continue
        seen.add(key)
        const label = param.optionsQuery.labelColumn
          ? row[param.optionsQuery.labelColumn]
          : undefined
        options.push(
          label === undefined || label === null
            ? { value: key }
            : { value: key, label: String(label) }
        )
      }
      return options
    },
    [document.queries, scope]
  )

  const hasManual = used.some((q) => q.runMode === "manual")
  const queryState = (name: string): QueryState | undefined => {
    const query = document.queries.find((q) => q.name === name)
    return query ? (states[query.id] ?? { status: "idle" }) : undefined
  }

  return {
    variables,
    setVariable,
    setVariables,
    states,
    queryState,
    scope,
    widgetStates,
    setWidgetState,
    runByName,
    runManual,
    freeParams,
    paramOptions,
    /** Parameter values a query would run with right now (bindings resolved). */
    resolve: (query: AppQuery) => resolveParams(query, variables, scope),
    hasManual,
    usedQueries: used,
  }
}

export type AppRuntime = ReturnType<typeof useAppRuntime>
