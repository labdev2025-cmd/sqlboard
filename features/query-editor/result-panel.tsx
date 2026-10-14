"use client"

import * as React from "react"
import {
  AlertTriangleIcon,
  Clock3Icon,
  DatabaseIcon,
  RowsIcon,
} from "lucide-react"

import { EmptyState } from "@/components/app-shell/states"
import { ResultTable } from "@/components/data/result-table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCount, formatDuration } from "@/lib/format"

import type { ExecutionState } from "./use-execution"

function Elapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])
  return (
    <span className="tabular-nums">
      {formatDuration(Math.max(0, now - startedAt))}
    </span>
  )
}

export function ResultPanel({
  state,
  sql,
}: {
  state: ExecutionState
  sql?: string
}) {
  if (state.status === "idle") {
    return (
      <EmptyState
        icon={DatabaseIcon}
        title="Nenhum resultado ainda"
        description="Execute a query (Ctrl+Enter) para ver os dados aqui."
      />
    )
  }
  if (state.status === "running") {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-live="polite">
        <p className="text-sm text-muted-foreground">
          Executando… <Elapsed startedAt={state.startedAt} />
        </p>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </div>
    )
  }
  if (state.status === "error") {
    return (
      <Alert variant={state.cancelled ? "default" : "destructive"} role="alert">
        <AlertTriangleIcon />
        <AlertTitle>
          {state.cancelled ? "Execução cancelada" : "A query falhou"}
        </AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          {!state.cancelled ? <p>{state.message}</p> : null}
          {sql && !state.cancelled ? (
            <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 font-mono text-xs whitespace-pre-wrap text-foreground">
              {sql}
            </pre>
          ) : null}
        </AlertDescription>
      </Alert>
    )
  }
  const { result } = state
  return (
    <div className="flex min-w-0 flex-col gap-3" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">
          <RowsIcon data-icon="inline-start" />
          {formatCount(result.rowCount)}{" "}
          {result.rowCount === 1 ? "linha" : "linhas"}
        </Badge>
        <Badge variant="secondary">
          <Clock3Icon data-icon="inline-start" />
          {formatDuration(result.durationMs)}
        </Badge>
        {result.cached ? <Badge variant="outline">do cache</Badge> : null}
      </div>
      {result.truncated ? (
        <Alert>
          <AlertTriangleIcon />
          <AlertDescription>
            Mostrando {formatCount(result.rowCount)} de mais linhas (limite de{" "}
            {formatCount(result.limit)}). Refine os filtros para ver tudo.
          </AlertDescription>
        </Alert>
      ) : null}
      <ResultTable
        label="Resultado da query"
        columns={result.columns}
        rows={result.rows}
      />
    </div>
  )
}
