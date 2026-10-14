"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DIALECT_LABELS, type ConnectionView } from "@/lib/connections/schema"

import { ConnectionAccess } from "./connection-access"
import { ConnectionForm } from "./connection-form"
import { SchemaBrowser } from "./schema-browser"

export function ConnectionDetail({
  connection,
  isAdmin,
}: {
  connection: ConnectionView
  isAdmin: boolean
}) {
  return (
    <Tabs
      defaultValue={isAdmin ? "details" : "schema"}
      className="flex flex-col gap-4"
    >
      <TabsList>
        <TabsTrigger value="details">Detalhes</TabsTrigger>
        <TabsTrigger value="schema">Schema</TabsTrigger>
        {isAdmin ? <TabsTrigger value="access">Acesso</TabsTrigger> : null}
      </TabsList>
      <TabsContent value="details">
        {isAdmin ? (
          <ConnectionForm connection={connection} />
        ) : (
          <dl className="grid max-w-xl grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Banco</dt>
            <dd>{DIALECT_LABELS[connection.dialect]}</dd>
            <dt className="text-muted-foreground">Endereço</dt>
            <dd className="font-mono break-all">
              {connection.host}:{connection.port}/{connection.database}
            </dd>
            <dt className="text-muted-foreground">Limite de linhas</dt>
            <dd>
              {connection.defaultRowLimit.toLocaleString("pt-BR")} (máx.{" "}
              {connection.maxRowLimit.toLocaleString("pt-BR")})
            </dd>
            <dt className="text-muted-foreground">Tempo limite</dt>
            <dd>{connection.statementTimeoutMs / 1000} s</dd>
          </dl>
        )}
      </TabsContent>
      <TabsContent value="schema">
        <SchemaBrowser connectionId={connection.id} className="max-w-3xl" />
      </TabsContent>
      {isAdmin ? (
        <TabsContent value="access">
          <ConnectionAccess connectionId={connection.id} />
        </TabsContent>
      ) : null}
    </Tabs>
  )
}
