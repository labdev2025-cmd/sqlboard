"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { DatabaseIcon, PlusIcon } from "lucide-react"

import { EmptyState } from "@/components/app-shell/states"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { api, errorMessage } from "@/lib/api-client"
import { DIALECT_LABELS, type ConnectionView } from "@/lib/connections/schema"

export function useConnections(purpose?: "read" | "write") {
  return useQuery({
    queryKey: ["connections", purpose ?? "all"],
    queryFn: () =>
      api<ConnectionView[]>(
        `/api/connections${purpose ? `?purpose=${purpose}` : ""}`
      ),
  })
}

export function ConnectionsList({ isAdmin }: { isAdmin: boolean }) {
  const connections = useConnections()

  if (connections.isPending) {
    return (
      <div
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        aria-busy="true"
      >
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    )
  }
  if (connections.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{errorMessage(connections.error)}</AlertDescription>
      </Alert>
    )
  }
  if (connections.data.length === 0) {
    return (
      <EmptyState
        icon={DatabaseIcon}
        title="Nenhuma conexão disponível"
        description={
          isAdmin
            ? "Cadastre um banco para a equipe consultar."
            : "Peça a um administrador acesso a uma conexão."
        }
      >
        {isAdmin ? (
          <Link href="/connections/new" className={buttonVariants()}>
            <PlusIcon data-icon="inline-start" />
            Nova conexão
          </Link>
        ) : null}
      </EmptyState>
    )
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {connections.data.map((connection) => (
        <li key={connection.id}>
          <Link
            href={`/connections/${connection.id}`}
            className="block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {DIALECT_LABELS[connection.dialect]}
                  </Badge>
                  {connection.isDemo ? (
                    <Badge variant="outline">demo</Badge>
                  ) : null}
                  {connection.purpose === "write" ? (
                    <Badge variant="warning">escrita</Badge>
                  ) : null}
                </div>
                <CardTitle className="truncate">{connection.name}</CardTitle>
                <CardDescription className="truncate font-mono text-xs">
                  {connection.dialect === "sqlite"
                    ? connection.database
                    : `${connection.username}@${connection.host}:${connection.port ?? ""}/${connection.database}`}
                </CardDescription>
                {connection.description ? (
                  <CardDescription className="line-clamp-2">
                    {connection.description}
                  </CardDescription>
                ) : null}
              </CardHeader>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  )
}
