"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  PencilIcon,
  PlayIcon,
  PlusIcon,
  SquarePenIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react"

import { EmptyState } from "@/components/app-shell/states"
import { ParamsForm } from "@/components/params/param-inputs"
import { PickerState } from "@/components/picker-state"
import { SimpleSelect } from "@/components/simple-select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
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
import type {
  ActionPreview,
  ActionResult,
  WriteActionView,
} from "@/lib/actions/schema"
import { api, errorMessage, fieldErrors } from "@/lib/api-client"
import type { ConnectionView } from "@/lib/connections/schema"
import { syncParams } from "@/lib/sql-params/infer"
import {
  PARAM_TYPE_LABELS,
  PARAM_TYPES,
  type ParamDefinition,
  type ParamType,
  type RawParamValue,
} from "@/lib/sql-params/types"
import type { SqlDialect } from "@/lib/sql-params"

export function ActionsManager({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient()
  const [running, setRunning] = React.useState<WriteActionView | null>(null)
  const [editing, setEditing] = React.useState<WriteActionView | "new" | null>(
    null
  )
  const actions = useQuery({
    queryKey: ["actions"],
    queryFn: () => api<WriteActionView[]>("/api/actions"),
  })
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ["actions"] })
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/actions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.add({ title: "Ação excluída", type: "success" })
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
          Cada ação é um INSERT ou UPDATE revisado por um administrador. Você
          preenche os valores, vê a prévia do que será gravado e confirma.
        </p>
        {isAdmin ? (
          <Button onClick={() => setEditing("new")}>
            <PlusIcon data-icon="inline-start" />
            Nova ação
          </Button>
        ) : null}
      </div>
      {actions.isPending ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : actions.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(actions.error)}</AlertDescription>
        </Alert>
      ) : actions.data.length === 0 ? (
        <EmptyState
          icon={SquarePenIcon}
          title="Nenhuma ação disponível"
          description={
            isAdmin
              ? "Cadastre uma conexão com uso “Escrita controlada” e crie a primeira ação."
              : "Peça a um administrador acesso a uma conexão de escrita."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {actions.data.map((action) => (
            <Card key={action.id}>
              <CardHeader>
                <CardTitle>{action.name}</CardTitle>
                <CardDescription>
                  {action.description || "Sem descrição."}
                </CardDescription>
                {action.canManage ? (
                  <CardAction className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar ${action.name}`}
                      onClick={() => setEditing(action)}
                    >
                      <PencilIcon />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Excluir ${action.name}`}
                            disabled={
                              remove.isPending && remove.variables === action.id
                            }
                          />
                        }
                      >
                        <Trash2Icon />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Excluir “{action.name}”?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            A ação deixa de estar disponível. Os registros de
                            auditoria continuam.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => remove.mutate(action.id)}
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardAction>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge variant="secondary">{action.connectionName}</Badge>
                <Badge variant="outline">
                  até {action.maxAffectedRows} linha(s)
                </Badge>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  onClick={() => setRunning(action)}
                  aria-label={`Executar ${action.name}`}
                >
                  <PlayIcon data-icon="inline-start" />
                  Executar
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      <RunActionDialog
        key={running?.id ?? "closed"}
        action={running}
        onClose={() => setRunning(null)}
      />
      {isAdmin ? (
        <ActionFormDialog
          key={editing === "new" ? "new" : (editing?.id ?? "closed")}
          action={editing === "new" ? null : editing}
          open={editing !== null}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      ) : null}
    </div>
  )
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "NULL"
  if (Array.isArray(value)) return value.join(", ")
  return String(value)
}

function RunActionDialog({
  action,
  onClose,
}: {
  action: WriteActionView | null
  onClose: () => void
}) {
  const [values, setValues] = React.useState<Record<string, RawParamValue>>(
    () =>
      Object.fromEntries(
        (action?.params ?? []).map((p) => [p.name, p.default ?? null])
      )
  )
  const [preview, setPreview] = React.useState<ActionPreview | null>(null)
  const previewMutation = useMutation({
    mutationFn: () =>
      api<ActionPreview>(`/api/actions/${action!.id}/preview`, {
        method: "POST",
        body: { values },
      }),
    onSuccess: setPreview,
  })
  const confirm = useMutation({
    mutationFn: () =>
      api<ActionResult>(`/api/actions/${action!.id}/run`, {
        method: "POST",
        body: { values, previewToken: preview!.previewToken },
      }),
    onSuccess: (result) => {
      toast.add({
        title: "Gravado",
        description: `${result.affectedRows} linha(s) afetada(s).`,
        type: "success",
      })
      onClose()
    },
  })
  const error = previewMutation.error ?? confirm.error

  return (
    <Dialog
      open={action !== null}
      onOpenChange={(next) => (next ? null : onClose())}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{action?.name ?? "Ação"}</DialogTitle>
          <DialogDescription>
            {preview
              ? "Confira o que será gravado e confirme."
              : "Preencha os valores e gere a prévia. Nada é gravado até você confirmar."}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(error)}</AlertDescription>
          </Alert>
        ) : null}
        {!preview ? (
          <form
            id="action-run-form"
            onSubmit={(event) => {
              event.preventDefault()
              previewMutation.mutate()
            }}
          >
            {action?.params.length ? (
              <ParamsForm
                params={action.params}
                values={values}
                onChange={(name, value) =>
                  setValues((prev) => ({ ...prev, [name]: value }))
                }
                idPrefix="action-param"
                className="sm:grid-cols-2 lg:grid-cols-2"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Esta ação não tem parâmetros.
              </p>
            )}
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <Alert>
              <TriangleAlertIcon />
              <AlertTitle>
                {preview.affectedRows} linha(s) serão afetadas
              </AlertTitle>
              <AlertDescription>
                A prévia rodou numa transação desfeita. A prévia vale até{" "}
                {new Date(preview.expiresAt).toLocaleTimeString("pt-BR")}.
              </AlertDescription>
            </Alert>
            <pre
              className="max-h-40 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap"
              tabIndex={0}
              aria-label="Comando que será executado"
            >
              {preview.sql}
            </pre>
            {preview.values.length ? (
              <div className="overflow-x-auto rounded-lg border">
                <Table aria-label="Valores enviados">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parâmetro</TableHead>
                      <TableHead>Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.values.map((v) => (
                      <TableRow key={v.name}>
                        <TableCell className="font-mono">{v.name}</TableCell>
                        <TableCell className="break-all">
                          {formatValue(v.value)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </div>
        )}
        <DialogFooter>
          {preview ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setPreview(null)
                  confirm.reset()
                }}
              >
                Alterar valores
              </Button>
              <Button
                variant="destructive"
                disabled={confirm.isPending}
                onClick={() => confirm.mutate()}
              >
                {confirm.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : null}
                Confirmar e gravar
              </Button>
            </>
          ) : (
            <>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancelar
              </DialogClose>
              <Button
                type="submit"
                form="action-run-form"
                disabled={previewMutation.isPending}
              >
                {previewMutation.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : null}
                Gerar prévia
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const typeItems = PARAM_TYPES.map((t) => ({
  value: t,
  label: PARAM_TYPE_LABELS[t],
}))

function ActionFormDialog({
  action,
  open,
  onClose,
  onSaved,
}: {
  action: WriteActionView | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = React.useState(action?.name ?? "")
  const [description, setDescription] = React.useState(
    action?.description ?? ""
  )
  const [connectionId, setConnectionId] = React.useState<string | null>(
    action?.connectionId ?? null
  )
  const [sqlText, setSqlText] = React.useState(action?.sql ?? "")
  const [params, setParams] = React.useState<ParamDefinition[]>(
    action?.params ?? []
  )
  const [maxRows, setMaxRows] = React.useState(
    String(action?.maxAffectedRows ?? 1)
  )
  const connections = useQuery({
    queryKey: ["connections", "write"],
    queryFn: () => api<ConnectionView[]>("/api/connections?purpose=write"),
    enabled: open,
  })
  const dialect = (connections.data?.find((c) => c.id === connectionId)
    ?.dialect ?? "postgres") as SqlDialect
  const detected = React.useMemo(() => {
    try {
      return syncParams(sqlText, params, dialect)
    } catch {
      return params
    }
  }, [sqlText, params, dialect])

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name,
        description,
        connectionId,
        sql: sqlText,
        params: detected,
        maxAffectedRows: Number(maxRows),
      }
      return action
        ? api(`/api/actions/${action.id}`, { method: "PUT", body })
        : api("/api/actions", { method: "POST", body })
    },
    onSuccess: () => {
      toast.add({ title: "Ação salva", type: "success" })
      onSaved()
      onClose()
    },
  })

  const setType = (paramName: string, type: ParamType) =>
    setParams(detected.map((p) => (p.name === paramName ? { ...p, type } : p)))

  const errors = fieldErrors(save.error)

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="sm:max-w-2xl">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate()
          }}
        >
          <DialogHeader>
            <DialogTitle>{action ? "Editar ação" : "Nova ação"}</DialogTitle>
            <DialogDescription>
              Um único INSERT ou UPDATE (com WHERE). Valores entram como
              parâmetros :nome, nunca no texto do SQL.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {save.isError && !Object.keys(errors).length ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{errorMessage(save.error)}</AlertDescription>
              </Alert>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field data-invalid={errors.name ? true : undefined}>
                <FieldLabel htmlFor="action-name">Nome</FieldLabel>
                <Input
                  id="action-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="off"
                  aria-invalid={errors.name ? true : undefined}
                />
                {errors.name ? <FieldError>{errors.name}</FieldError> : null}
              </Field>
              <Field data-invalid={errors.connectionId ? true : undefined}>
                <FieldLabel htmlFor="action-connection">
                  Conexão de escrita
                </FieldLabel>
                <SimpleSelect
                  id="action-connection"
                  items={(connections.data ?? []).map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                  value={connectionId}
                  onValueChange={setConnectionId}
                  disabled={connections.isPending}
                />
                <PickerState
                  error={connections.error}
                  empty={connections.data?.length === 0}
                  emptyText="Nenhuma conexão de escrita. Cadastre uma em Conexões com uso “Escrita controlada”."
                />
                {errors.connectionId ? (
                  <FieldError>{errors.connectionId}</FieldError>
                ) : null}
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="action-description">Descrição</FieldLabel>
              <Input
                id="action-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field data-invalid={errors.sql ? true : undefined}>
              <FieldLabel htmlFor="action-sql">Comando SQL</FieldLabel>
              <Textarea
                id="action-sql"
                value={sqlText}
                onChange={(e) => setSqlText(e.target.value)}
                rows={5}
                spellCheck={false}
                className="font-mono text-sm"
                placeholder="update loja.solicitacoes set status = :status where id = :id"
                required
                aria-invalid={errors.sql ? true : undefined}
              />
              {errors.sql ? <FieldError>{errors.sql}</FieldError> : null}
            </Field>
            {detected.length ? (
              <FieldSet className="gap-2">
                <FieldLegend variant="label">Tipos dos parâmetros</FieldLegend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {detected.map((p) => (
                    <Field key={p.name}>
                      <FieldLabel htmlFor={`action-type-${p.name}`}>
                        :{p.name}
                      </FieldLabel>
                      <SimpleSelect
                        id={`action-type-${p.name}`}
                        items={typeItems}
                        value={p.type}
                        onValueChange={(type) => setType(p.name, type)}
                      />
                    </Field>
                  ))}
                </div>
              </FieldSet>
            ) : null}
            <Field
              className="sm:max-w-56"
              data-invalid={errors.maxAffectedRows ? true : undefined}
            >
              <FieldLabel htmlFor="action-max">
                Máximo de linhas afetadas
              </FieldLabel>
              <Input
                id="action-max"
                type="number"
                inputMode="numeric"
                min={1}
                max={10000}
                value={maxRows}
                onChange={(e) => setMaxRows(e.target.value)}
                required
                aria-invalid={errors.maxAffectedRows ? true : undefined}
              />
              {errors.maxAffectedRows ? (
                <FieldError>{errors.maxAffectedRows}</FieldError>
              ) : null}
              <FieldDescription>
                Acima disso, nada é gravado (a transação é desfeita).
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={save.isPending || !connectionId}>
              {save.isPending ? <Spinner data-icon="inline-start" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
