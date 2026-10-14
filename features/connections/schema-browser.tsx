"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ChevronRightIcon,
  EyeIcon,
  KeyRoundIcon,
  RefreshCwIcon,
  SearchIcon,
  TableIcon,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { api, errorMessage } from "@/lib/api-client"
import type { SchemaInfo } from "@/lib/data-types"
import { cn } from "@/lib/utils"

export function useSchema(connectionId: string | null) {
  return useQuery({
    queryKey: ["schema", connectionId],
    queryFn: () => api<SchemaInfo>(`/api/connections/${connectionId}/schema`),
    enabled: Boolean(connectionId),
    staleTime: 5 * 60_000,
  })
}

/**
 * Searchable tree of schemas → tables/views → columns, with the cached
 * introspection time and a refresh button. `onInsert` makes names clickable.
 */
export function SchemaBrowser({
  connectionId,
  onInsert,
  className,
}: {
  connectionId: string
  onInsert?: (text: string) => void
  className?: string
}) {
  const queryClient = useQueryClient()
  const schema = useSchema(connectionId)
  const [search, setSearch] = React.useState("")
  const [refreshing, setRefreshing] = React.useState(false)
  const [refreshError, setRefreshError] = React.useState<string | null>(null)

  async function refresh() {
    setRefreshing(true)
    setRefreshError(null)
    try {
      const fresh = await api<SchemaInfo>(
        `/api/connections/${connectionId}/schema?refresh=1`
      )
      queryClient.setQueryData(["schema", connectionId], fresh)
    } catch (error) {
      setRefreshError(errorMessage(error))
    } finally {
      setRefreshing(false)
    }
  }

  const term = search.trim().toLowerCase()
  const tables = (schema.data?.tables ?? []).filter(
    (t) =>
      !term ||
      t.name.toLowerCase().includes(term) ||
      t.schema.toLowerCase().includes(term) ||
      t.columns.some((c) => c.name.toLowerCase().includes(term))
  )

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <InputGroup className="min-w-0 flex-1">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Buscar tabela ou coluna"
            placeholder="Buscar tabela ou coluna"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
        <Button
          variant="outline"
          size="icon"
          aria-label="Atualizar schema"
          onClick={refresh}
          disabled={refreshing}
        >
          {refreshing ? <Spinner /> : <RefreshCwIcon />}
        </Button>
      </div>
      {schema.data ? (
        <p className="text-xs text-muted-foreground">
          {schema.data.serverVersion} · lido em{" "}
          {new Date(schema.data.introspectedAt).toLocaleString("pt-BR")}
        </p>
      ) : null}
      {refreshError ? (
        <Alert variant="destructive">
          <AlertDescription>{refreshError}</AlertDescription>
        </Alert>
      ) : null}
      {schema.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      ) : schema.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(schema.error)}</AlertDescription>
        </Alert>
      ) : tables.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {term
            ? "Nada encontrado."
            : "Nenhuma tabela visível para este usuário."}
        </p>
      ) : (
        <ul
          className="flex min-h-0 flex-col overflow-y-auto text-sm"
          aria-label="Tabelas e views"
        >
          {tables.map((table) => {
            const qualified = `${table.schema}.${table.name}`
            return (
              <li key={qualified}>
                <Collapsible defaultOpen={Boolean(term)}>
                  <div className="flex items-center gap-1">
                    <CollapsibleTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="group/table min-w-0 flex-1 justify-start"
                        />
                      }
                    >
                      <ChevronRightIcon
                        data-icon="inline-start"
                        className="transition-transform group-data-panel-open/table:rotate-90"
                      />
                      {table.type === "view" ? <EyeIcon /> : <TableIcon />}
                      <span className="truncate">
                        <span className="text-muted-foreground">
                          {table.schema}.
                        </span>
                        {table.name}
                      </span>
                    </CollapsibleTrigger>
                    {onInsert ? (
                      <Button
                        variant="ghost"
                        size="xs"
                        aria-label={`Inserir ${qualified} no editor`}
                        onClick={() => onInsert(qualified)}
                      >
                        Inserir
                      </Button>
                    ) : null}
                  </div>
                  <CollapsibleContent>
                    {table.comment ? (
                      <p className="px-8 pb-1 text-xs text-muted-foreground">
                        {table.comment}
                      </p>
                    ) : null}
                    <ul className="flex flex-col pb-2 pl-8">
                      {table.columns.map((column) => (
                        <li
                          key={column.name}
                          className="flex min-w-0 items-center gap-2 py-0.5"
                        >
                          {onInsert ? (
                            <button
                              type="button"
                              className="truncate font-mono text-xs hover:underline focus-visible:underline"
                              onClick={() => onInsert(column.name)}
                              title={column.comment ?? undefined}
                            >
                              {column.name}
                            </button>
                          ) : (
                            <span
                              className="truncate font-mono text-xs"
                              title={column.comment ?? undefined}
                            >
                              {column.name}
                            </span>
                          )}
                          {column.primaryKey ? (
                            <KeyRoundIcon
                              className="size-3 text-muted-foreground"
                              aria-label="chave primária"
                            />
                          ) : null}
                          <Badge
                            variant="outline"
                            className="ml-auto font-mono"
                          >
                            {column.type}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
