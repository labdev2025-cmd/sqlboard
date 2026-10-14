"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { FileCode2Icon, PlusIcon, SearchIcon } from "lucide-react"

import { EmptyState } from "@/components/app-shell/states"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useDebounced } from "@/hooks/use-debounced"
import { api, errorMessage } from "@/lib/api-client"
import type { SavedQueryView } from "@/lib/queries/schema"

export function useSavedQueries(
  filters: { q?: string; tag?: string; mine?: boolean } = {}
) {
  const search = new URLSearchParams()
  if (filters.q) search.set("q", filters.q)
  if (filters.tag) search.set("tag", filters.tag)
  if (filters.mine) search.set("mine", "1")
  return useQuery({
    queryKey: ["queries", filters],
    queryFn: () => api<SavedQueryView[]>(`/api/queries?${search}`),
  })
}

export function QueriesLibrary() {
  const [text, setText] = React.useState("")
  const [scope, setScope] = React.useState<string[]>(["all"])
  const [tag, setTag] = React.useState<string | null>(null)
  const q = useDebounced(text)
  const queries = useSavedQueries({
    q,
    tag: tag ?? undefined,
    mine: scope[0] === "mine",
  })
  const all = useSavedQueries()
  const tags = [
    ...new Set((all.data ?? []).flatMap((item) => item.tags)),
  ].sort()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-full max-w-sm">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Buscar queries por nome, descrição ou tag"
            placeholder="Buscar por nome, descrição ou tag"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </InputGroup>
        <ToggleGroup
          value={scope}
          onValueChange={(value) =>
            setScope(value.length ? (value as string[]) : ["all"])
          }
          variant="outline"
          aria-label="Filtrar por dono"
        >
          <ToggleGroupItem value="all">Todas</ToggleGroupItem>
          <ToggleGroupItem value="mine">Minhas</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {tags.length ? (
        <div
          className="flex flex-wrap items-center gap-1.5"
          aria-label="Filtrar por tag"
          role="group"
        >
          {tags.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={tag === item}
              onClick={() => setTag(tag === item ? null : item)}
              className="rounded-4xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Badge variant={tag === item ? "default" : "outline"}>
                #{item}
              </Badge>
            </button>
          ))}
        </div>
      ) : null}
      {queries.isPending ? (
        <div
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          aria-busy="true"
        >
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : queries.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(queries.error)}</AlertDescription>
        </Alert>
      ) : queries.data.length === 0 ? (
        <EmptyState
          icon={FileCode2Icon}
          title={q || tag ? "Nenhuma query encontrada" : "Nenhuma query ainda"}
          description={
            q || tag
              ? "Tente outros termos."
              : "Escreva SQL e os parâmetros viram campos."
          }
        >
          {!q && !tag ? (
            <Link href="/queries/new" className={buttonVariants()}>
              <PlusIcon data-icon="inline-start" />
              Nova query
            </Link>
          ) : null}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {queries.data.map((item) => (
            <li key={item.id}>
              <Link
                href={`/queries/${item.id}`}
                className="block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle className="truncate">{item.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {item.description || "Sem descrição."}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="mt-auto flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="secondary">{item.connectionName}</Badge>
                    {item.tags.map((t) => (
                      <Badge key={t} variant="outline">
                        #{t}
                      </Badge>
                    ))}
                    <span className="ml-auto">
                      {item.ownerName} · v{item.version}
                    </span>
                  </CardFooter>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
