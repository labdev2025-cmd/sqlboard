"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronLeftIcon, ChevronRightIcon, ScrollTextIcon } from "lucide-react"

import { EmptyState } from "@/components/app-shell/states"
import { SimpleSelect } from "@/components/simple-select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { api, errorMessage } from "@/lib/api-client"
import { formatCount, formatDuration } from "@/lib/format"

type AuditRow = {
  id: string
  createdAt: string
  userName: string | null
  connectionName: string | null
  appName: string | null
  queryName: string
  source: string
  sqlHash: string
  params: Record<string, unknown>
  status: string
  durationMs: number
  rowCount: number
  truncated: boolean
  cached: boolean
  error: string | null
}

const SOURCE_LABELS: Record<string, string> = {
  editor: "Editor",
  app: "Tela",
  export: "Exportação",
  compare: "Comparação IA",
  explain: "Explain",
  schedule: "Agendamento",
  mcp: "MCP",
  options: "Opções",
  action: "Ação de escrita",
}

const STATUS_ITEMS = [
  { value: "all", label: "Todos os status" },
  { value: "ok", label: "Sucesso" },
  { value: "error", label: "Erro" },
  { value: "cancelled", label: "Cancelada" },
]

export function AuditLog() {
  const queryClient = useQueryClient()
  const [status, setStatus] = React.useState("all")
  const [page, setPage] = React.useState(1)
  const log = useQuery({
    queryKey: ["audit", status, page],
    queryFn: () =>
      api<{ total: number; page: number; pageSize: number; rows: AuditRow[] }>(
        `/api/admin/audit?page=${page}&pageSize=50${status !== "all" ? `&status=${status}` : ""}`
      ),
  })
  const settings = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => api<{ maskParams: boolean }>("/api/admin/settings"),
  })
  const mask = useMutation({
    mutationFn: (maskParams: boolean) =>
      api("/api/admin/settings", { method: "PUT", body: { maskParams } }),
    onSuccess: () => {
      toast.add({ title: "Configuração salva", type: "success" })
      void queryClient.invalidateQueries({ queryKey: ["admin-settings"] })
    },
    onError: (error) =>
      toast.add({
        title: "Erro",
        description: errorMessage(error),
        type: "error",
      }),
  })
  const pages = log.data
    ? Math.max(1, Math.ceil(log.data.total / log.data.pageSize))
    : 1

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Field className="w-full max-w-56">
          <FieldLabel htmlFor="audit-status">Status</FieldLabel>
          <SimpleSelect
            id="audit-status"
            items={STATUS_ITEMS}
            value={status}
            onValueChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
          />
        </Field>
        <Field orientation="horizontal" className="w-auto">
          <Switch
            id="audit-mask"
            checked={settings.data?.maskParams ?? false}
            disabled={settings.isPending || mask.isPending}
            onCheckedChange={(checked) => mask.mutate(checked)}
          />
          <div className="flex flex-col">
            <FieldLabel htmlFor="audit-mask">
              Mascarar valores de parâmetros
            </FieldLabel>
            <FieldDescription>
              Novas execuções guardam só os nomes.
            </FieldDescription>
          </div>
        </Field>
      </div>
      {log.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : log.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(log.error)}</AlertDescription>
        </Alert>
      ) : log.data.rows.length === 0 ? (
        <EmptyState icon={ScrollTextIcon} title="Nenhuma execução registrada" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table aria-label="Execuções de queries">
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Conexão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Linhas</TableHead>
                  <TableHead className="text-right">Duração</TableHead>
                  <TableHead>Hash do SQL</TableHead>
                  <TableHead>Parâmetros</TableHead>
                  <TableHead>
                    <span className="sr-only">Detalhes</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {log.data.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>{row.userName ?? "—"}</TableCell>
                    <TableCell>
                      {SOURCE_LABELS[row.source] ?? row.source}
                      {row.appName ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {row.appName}
                        </span>
                      ) : null}
                      {row.queryName ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {row.queryName}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{row.connectionName ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === "ok"
                            ? "success"
                            : row.status === "cancelled"
                              ? "warning"
                              : "destructive"
                        }
                      >
                        {row.status === "ok"
                          ? "sucesso"
                          : row.status === "cancelled"
                            ? "cancelada"
                            : "erro"}
                      </Badge>
                      {row.cached ? (
                        <Badge variant="outline" className="ml-1">
                          cache
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(row.rowCount)}
                      {row.truncated ? "+" : ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDuration(row.durationMs)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.sqlHash.slice(0, 12)}
                    </TableCell>
                    <TableCell
                      className="max-w-64 truncate font-mono text-xs"
                      title={JSON.stringify(row.params)}
                    >
                      {JSON.stringify(row.params)}
                    </TableCell>
                    <TableCell>
                      <AuditDetails row={row} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{formatCount(log.data.total)} execuções</span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Página anterior"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeftIcon />
              </Button>
              <span className="px-2 tabular-nums">
                {page} / {pages}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Próxima página"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function AuditDetails({ row }: { row: AuditRow }) {
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="xs" />}
        aria-label={`Detalhes da execução de ${new Date(row.createdAt).toLocaleString("pt-BR")}`}
      >
        Detalhes
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <PopoverHeader>
          <PopoverTitle>Detalhes da execução</PopoverTitle>
          <PopoverDescription>
            {new Date(row.createdAt).toLocaleString("pt-BR")}
          </PopoverDescription>
        </PopoverHeader>
        <dl className="flex flex-col gap-2 text-sm">
          {row.error ? (
            <div className="flex flex-col gap-0.5">
              <dt className="font-medium">Erro</dt>
              <dd className="text-destructive">{row.error}</dd>
            </div>
          ) : null}
          <div className="flex flex-col gap-0.5">
            <dt className="font-medium">Hash do SQL</dt>
            <dd className="font-mono text-xs break-all">{row.sqlHash}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="font-medium">Parâmetros</dt>
            <dd className="max-h-48 overflow-auto font-mono text-xs break-all whitespace-pre-wrap">
              {JSON.stringify(row.params, null, 2)}
            </dd>
          </div>
        </dl>
      </PopoverContent>
    </Popover>
  )
}
