"use client"

import * as React from "react"

import type { AppDocument, AppQuery, Page, Widget } from "@/lib/app-schema"
import { api, ApiError } from "@/lib/api-client"
import { bindingRoots, type BindingScope } from "@/lib/bindings"
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
  return document.queries.filter((q) => names.has(q.name))
}

function paramValues(
  query: AppQuery,
  variables: RawParamValues
): RawParamValues {
  return Object.fromEntries(
    query.params.map((p) => [p.name, variables[p.name] ?? null])
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
          ? await runner(query, paramValues(query, values), controller.signal)
          : await api<QueryResult & { cached?: boolean }>(
              `/api/apps/${appId}/run`,
              {
                method: "POST",
                body: {
                  queryId: query.id,
                  values: paramValues(query, values),
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

  // Auto-run used queries when their parameter values change (debounced).
  React.useEffect(() => {
    const timer = setTimeout(() => {
      for (const query of used) {
        if (query.runMode !== "auto") continue
        const key = JSON.stringify([query.sql, paramValues(query, variables)])
        if (lastKeys.current.get(query.id) === key) continue
        lastKeys.current.set(query.id, key)
        void run(query, variables)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [used, variables, run])

  React.useEffect(() => {
    const all = controllers.current
    return () => all.forEach((controller) => controller.abort())
  }, [])

  const runByName = React.useCallback(
    (name: string) => {
      const query = document.queries.find((q) => q.name === name)
      if (query) {
        lastKeys.current.set(
          query.id,
          JSON.stringify([query.sql, paramValues(query, variables)])
        )
        void run(query, variables)
      }
    },
    [document.queries, run, variables]
  )

  const runManual = React.useCallback(() => {
    for (const query of used) {
      lastKeys.current.set(
        query.id,
        JSON.stringify([query.sql, paramValues(query, variables)])
      )
      void run(query, variables)
    }
  }, [used, run, variables])

  const setVariable = React.useCallback(
    (name: string, value: RawParamValue) => {
      setVariables((prev) => ({ ...prev, [name]: value }))
    },
    []
  )

  const setWidgetState = React.useCallback((id: string, state: WidgetState) => {
    setWidgetStates((prev) => ({ ...prev, [id]: { ...prev[id], ...state } }))
  }, [])

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

  /** Variables used by queries of this page but not set by any input widget. */
  const freeParams = React.useMemo(() => {
    const controlled = new Set(
      page.widgets.flatMap((w: Widget) => widgetVariables(w))
    )
    const seen = new Map<string, AppQuery["params"][number]>()
    for (const query of used) {
      for (const param of query.params) {
        if (!controlled.has(param.name) && !seen.has(param.name))
          seen.set(param.name, param)
      }
    }
    return [...seen.values()]
  }, [page.widgets, used])

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
    hasManual,
    usedQueries: used,
  }
}

export type AppRuntime = ReturnType<typeof useAppRuntime>
