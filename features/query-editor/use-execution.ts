"use client"

import * as React from "react"

import { api, ApiError } from "@/lib/api-client"
import type { QueryResult } from "@/lib/data-types"
import type { ParamDefinition, RawParamValues } from "@/lib/sql-params/types"

export type ExecutionResult = QueryResult & {
  cached: boolean
  executionId: string
}

export type ExecutionState =
  | { status: "idle" }
  | { status: "running"; startedAt: number }
  | { status: "success"; result: ExecutionResult }
  | { status: "error"; message: string; cancelled: boolean }

export type RunInput = {
  connectionId: string
  sql: string
  params: ParamDefinition[]
  values: RawParamValues
  savedQueryId?: string
  source?: "editor" | "compare"
}

/** Runs ad-hoc SQL with abort + server-side cancel (pg_cancel_backend). */
export function useExecution() {
  const [state, setState] = React.useState<ExecutionState>({ status: "idle" })
  const current = React.useRef<{
    controller: AbortController
    id: string
  } | null>(null)

  const run = React.useCallback(async (input: RunInput) => {
    current.current?.controller.abort()
    const controller = new AbortController()
    const executionId = crypto.randomUUID()
    current.current = { controller, id: executionId }
    setState({ status: "running", startedAt: Date.now() })
    try {
      const result = await api<ExecutionResult>("/api/execute", {
        method: "POST",
        body: { ...input, executionId },
        signal: controller.signal,
      })
      if (current.current?.id === executionId)
        setState({ status: "success", result })
      return result
    } catch (error) {
      if (current.current?.id !== executionId) return null
      const cancelled =
        (error as Error)?.name === "AbortError" ||
        (error instanceof ApiError && error.status === 499)
      setState({
        status: "error",
        cancelled,
        message: cancelled ? "Execução cancelada." : (error as Error).message,
      })
      return null
    }
  }, [])

  const cancel = React.useCallback(async () => {
    const running = current.current
    if (!running) return
    // Ask the server to cancel the backend first, then drop the request.
    await api(`/api/executions/${running.id}/cancel`, { method: "POST" }).catch(
      () => undefined
    )
    running.controller.abort()
  }, [])

  return { state, run, cancel, reset: () => setState({ status: "idle" }) }
}
