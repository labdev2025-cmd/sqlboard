"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CalendarClockIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"

import { EmptyState } from "@/components/app-shell/states"
import { ParamsForm } from "@/components/params/param-inputs"
import { SimpleSelect } from "@/components/simple-select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { api, errorMessage } from "@/lib/api-client"
import type { SavedQueryView } from "@/lib/queries/schema"
import {
  FORMAT_LABELS,
  intervalLabel,
  INTERVALS,
  parseRecipients,
  SCHEDULE_FORMATS,
  type ScheduleFormat,
  type ScheduleView,
} from "@/lib/schedules/schema"
import type { RawParamValue } from "@/lib/sql-params/types"

type AppItem = { id: string; name: string; status: "draft" | "published" }
type TargetType = "query" | "app"

const formatItems = SCHEDULE_FORMATS.map((f) => ({
  value: f,
  label: FORMAT_LABELS[f],
}))
const intervalItems = INTERVALS.map((i) => ({
  value: String(i.value),
  label: i.label,
}))
const targetItems: { value: TargetType; label: string }[] = [
  { value: "query", label: "Query salva" },
  { value: "app", label: "Tela publicada" },
]

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR") : "—"

export function SchedulesManager() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = React.useState<ScheduleView | "new" | null>(
    null
  )
  const schedules = useQuery({
    queryKey: ["schedules"],
    queryFn: () => api<ScheduleView[]>("/api/schedules"),
  })
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ["schedules"] })
  const run = useMutation({
    mutationFn: (id: string) =>
      api<{ status: string; error: string | null; delivery: string | null }>(
        `/api/schedules/${id}/run`,
        { method: "POST" }
      ),
    onSuccess: (outcome) => {
      if (outcome.status === "ok") {
        toast.add({
          title: "Relatório enviado",
          description:
            outcome.delivery === "outbox"
              ? "Sem SMTP configurado: o e-mail foi gravado na caixa de saída do servidor."
              : undefined,
          type: "success",
        })
      } else {
        toast.add({
          title: "Falha na execução",
          description: outcome.error ?? undefined,
          type: "error",
        })
      }
      refresh()
    },
    onError: (error) =>
      toast.add({
        title: "Não foi possível executar",
        description: errorMessage(error),
        type: "error",
      }),
  })
  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/api/schedules/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.add({ title: "Agendamento excluído", type: "success" })
      refresh()
    },
    onError: (error) =>
      toast.add({
        title: "Não foi possível excluir",
        description: errorMessage(error),
        type: "error",
      }),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-prose text-sm text-muted-foreground">
          Rode uma query salva ou uma tela publicada em intervalos regulares e
          receba o resultado por e-mail. A execução usa as suas permissões no
          momento do envio.
        </p>
        <Button onClick={() => setEditing("new")}>
          <PlusIcon data-icon="inline-start" />
          Novo agendamento
        </Button>
      </div>
      {schedules.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : schedules.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(schedules.error)}</AlertDescription>
        </Alert>
      ) : schedules.data.length === 0 ? (
        <EmptyState
          icon={CalendarClockIcon}
          title="Nenhum agendamento"
          description="Crie um para receber relatórios por e-mail."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table aria-label="Agendamentos">
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">
                  Frequência
                </TableHead>
                <TableHead className="hidden lg:table-cell">Próxima</TableHead>
                <TableHead>Última</TableHead>
                <TableHead className="w-32">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-64">
                    <div className="flex flex-col gap-0.5">
                      <span className="truncate font-medium">
                        {row.name}
                        {!row.enabled ? (
                          <Badge variant="secondary" className="ml-2">
                            pausado
                          </Badge>
                        ) : null}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {row.target.type === "query" ? "Query" : "Tela"}:{" "}
                        {row.target.name} · {FORMAT_LABELS[row.format]} ·{" "}
                        {row.recipients.length} destinatário(s)
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {intervalLabel(row.intervalMinutes)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {row.enabled ? when(row.nextRunAt) : "—"}
                  </TableCell>
                  <TableCell>
                    {row.lastStatus ? (
                      <div className="flex flex-col gap-0.5">
                        <Badge
                          variant={
                            row.lastStatus === "ok" ? "success" : "destructive"
                          }
                        >
                          {row.lastStatus === "ok" ? "Enviado" : "Falhou"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {when(row.lastRunAt)}
                        </span>
                        {row.lastError ? (
                          <span className="max-w-56 text-xs text-destructive">
                            {row.lastError}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Nunca rodou
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Executar agora: ${row.name}`}
                        disabled={run.isPending}
                        onClick={() => run.mutate(row.id)}
                      >
                        {run.isPending && run.variables === row.id ? (
                          <Spinner />
                        ) : (
                          <PlayIcon />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${row.name}`}
                        onClick={() => setEditing(row)}
                      >
                        <PencilIcon />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Excluir ${row.name}`}
                            />
                          }
                        >
                          <Trash2Icon />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Excluir “{row.name}”?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Os destinatários deixam de receber este relatório.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              onClick={() => remove.mutate(row.id)}
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <ScheduleDialog
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        schedule={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
    </div>
  )
}

function ScheduleDialog({
  schedule,
  open,
  onClose,
  onSaved,
}: {
  schedule: ScheduleView | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = React.useState(schedule?.name ?? "")
  const [targetType, setTargetType] = React.useState<TargetType>(
    schedule?.target.type ?? "query"
  )
  const [targetId, setTargetId] = React.useState<string | null>(
    schedule
      ? schedule.target.type === "query"
        ? schedule.target.savedQueryId
        : schedule.target.appId
      : null
  )
  const [values, setValues] = React.useState<Record<string, RawParamValue>>(
    (schedule?.params ?? {}) as Record<string, RawParamValue>
  )
  const [interval, setIntervalValue] = React.useState(
    String(schedule?.intervalMinutes ?? 1440)
  )
  const [recipients, setRecipients] = React.useState(
    schedule?.recipients.join(", ") ?? ""
  )
  const [format, setFormat] = React.useState<ScheduleFormat>(
    schedule?.format ?? "csv"
  )
  const [enabled, setEnabled] = React.useState(schedule?.enabled ?? true)

  const queries = useQuery({
    queryKey: ["queries", "schedule-picker"],
    queryFn: () => api<SavedQueryView[]>("/api/queries"),
    enabled: open,
  })
  const apps = useQuery({
    queryKey: ["apps", "schedule-picker"],
    queryFn: () => api<AppItem[]>("/api/apps"),
    enabled: open,
  })
  const selectedQuery =
    targetType === "query"
      ? queries.data?.find((q) => q.id === targetId)
      : undefined
  const intervalChoices = intervalItems.some((i) => i.value === interval)
    ? intervalItems
    : [
        ...intervalItems,
        { value: interval, label: intervalLabel(Number(interval)) },
      ]

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name,
        target:
          targetType === "query"
            ? { type: "query", savedQueryId: targetId }
            : { type: "app", appId: targetId },
        params: targetType === "query" ? values : {},
        intervalMinutes: Number(interval),
        recipients: parseRecipients(recipients),
        format,
        enabled,
      }
      return schedule
        ? api(`/api/schedules/${schedule.id}`, { method: "PUT", body })
        : api("/api/schedules", { method: "POST", body })
    },
    onSuccess: () => {
      toast.add({ title: "Agendamento salvo", type: "success" })
      onSaved()
      onClose()
    },
  })

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="sm:max-w-xl">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate()
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {schedule ? "Editar agendamento" : "Novo agendamento"}
            </DialogTitle>
            <DialogDescription>
              O relatório roda com as suas permissões e vai anexado ao e-mail.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {save.isError ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{errorMessage(save.error)}</AlertDescription>
              </Alert>
            ) : null}
            <Field>
              <FieldLabel htmlFor="schedule-name">Nome</FieldLabel>
              <Input
                id="schedule-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="off"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="schedule-target-type">Origem</FieldLabel>
                <SimpleSelect
                  id="schedule-target-type"
                  items={targetItems}
                  value={targetType}
                  onValueChange={(next) => {
                    setTargetType(next)
                    setTargetId(null)
                    setValues({})
                  }}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="schedule-target">
                  {targetType === "query" ? "Query" : "Tela"}
                </FieldLabel>
                <SimpleSelect
                  id="schedule-target"
                  items={
                    targetType === "query"
                      ? (queries.data ?? []).map((q) => ({
                          value: q.id,
                          label: q.name,
                        }))
                      : (apps.data ?? [])
                          .filter((a) => a.status === "published")
                          .map((a) => ({ value: a.id, label: a.name }))
                  }
                  value={targetId}
                  onValueChange={(next) => {
                    setTargetId(next)
                    setValues({})
                  }}
                  disabled={queries.isPending || apps.isPending}
                />
              </Field>
            </div>
            {targetType === "app" ? (
              <FieldDescription>
                As queries da tela rodam com os valores padrão. Queries que
                dependem de clique ou de campo vazio ficam de fora e são citadas
                no e-mail.
              </FieldDescription>
            ) : null}
            {selectedQuery?.params.length ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">Parâmetros</legend>
                <ParamsForm
                  params={selectedQuery.params}
                  values={values}
                  onChange={(param, value) =>
                    setValues((prev) => ({ ...prev, [param]: value }))
                  }
                  idPrefix="schedule-param"
                  className="sm:grid-cols-2 lg:grid-cols-2"
                />
              </fieldset>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="schedule-interval">Frequência</FieldLabel>
                <SimpleSelect
                  id="schedule-interval"
                  items={intervalChoices}
                  value={interval}
                  onValueChange={setIntervalValue}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="schedule-format">Formato</FieldLabel>
                <SimpleSelect
                  id="schedule-format"
                  items={formatItems}
                  value={format}
                  onValueChange={setFormat}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="schedule-recipients">
                Destinatários
              </FieldLabel>
              <Textarea
                id="schedule-recipients"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="pessoa@empresa.com, equipe@empresa.com"
                rows={2}
                required
              />
              <FieldDescription>
                Separe os e-mails por vírgula ou quebra de linha.
              </FieldDescription>
            </Field>
            <Field orientation="horizontal">
              <Switch
                id="schedule-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
              <FieldLabel htmlFor="schedule-enabled">Ativo</FieldLabel>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={save.isPending || !targetId}>
              {save.isPending ? <Spinner data-icon="inline-start" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
