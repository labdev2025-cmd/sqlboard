"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PlugZapIcon, ShieldAlertIcon, Trash2Icon } from "lucide-react"

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
import { Button } from "@/components/ui/button"
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
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { api, ApiError, errorMessage } from "@/lib/api-client"
import {
  DEFAULT_PORTS,
  DIALECT_LABELS,
  DIALECTS,
  PURPOSE_LABELS,
  PURPOSES,
  SSL_LABELS,
  SSL_MODES,
  type ConnectionView,
  type Dialect,
} from "@/lib/connections/schema"

type FormState = {
  name: string
  description: string
  dialect: Dialect
  host: string
  port: string
  database: string
  username: string
  password: string
  clearPassword: boolean
  ssl: (typeof SSL_MODES)[number]
  statementTimeoutSec: string
  defaultRowLimit: string
  maxRowLimit: string
  purpose: (typeof PURPOSES)[number]
}

function initialState(connection?: ConnectionView): FormState {
  return {
    name: connection?.name ?? "",
    description: connection?.description ?? "",
    dialect: connection?.dialect ?? "postgres",
    host: connection?.host ?? "",
    port: connection?.port ? String(connection.port) : "5432",
    database: connection?.database ?? "",
    username: connection?.username ?? "",
    password: "",
    clearPassword: false,
    ssl: connection?.ssl ?? "disable",
    statementTimeoutSec: String(
      (connection?.statementTimeoutMs ?? 30000) / 1000
    ),
    defaultRowLimit: String(connection?.defaultRowLimit ?? 5000),
    maxRowLimit: String(connection?.maxRowLimit ?? 50000),
    purpose: connection?.purpose ?? "read",
  }
}

function toPayload(state: FormState) {
  return {
    name: state.name,
    description: state.description,
    dialect: state.dialect,
    host: state.host,
    port: state.port ? Number(state.port) : null,
    database: state.database,
    username: state.username,
    password: state.password || undefined,
    clearPassword: state.clearPassword || undefined,
    ssl: state.ssl,
    statementTimeoutMs: Math.round(Number(state.statementTimeoutSec) * 1000),
    defaultRowLimit: Number(state.defaultRowLimit),
    maxRowLimit: Number(state.maxRowLimit),
    purpose: state.purpose,
  }
}

type FieldErrors = Record<string, string>

function fieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return {}
  return Object.fromEntries(
    (error.details as { path: string; message: string }[]).map((d) => [
      d.path,
      d.message,
    ])
  )
}

export function ConnectionForm({
  connection,
}: {
  connection?: ConnectionView
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [state, setState] = React.useState(() => initialState(connection))
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }))
  const isSqlite = state.dialect === "sqlite"

  const save = useMutation({
    mutationFn: () =>
      connection
        ? api<ConnectionView>(`/api/connections/${connection.id}`, {
            method: "PUT",
            body: toPayload(state),
          })
        : api<ConnectionView>("/api/connections", {
            method: "POST",
            body: toPayload(state),
          }),
    onSuccess: (saved) => {
      toast.add({ title: "Conexão salva", type: "success" })
      void queryClient.invalidateQueries({ queryKey: ["connections"] })
      setState((prev) => ({ ...prev, password: "", clearPassword: false }))
      if (!connection) router.push(`/connections/${saved.id}`)
      else router.refresh()
    },
  })
  const test = useMutation({
    mutationFn: () =>
      api<{ ok: true }>("/api/connections/test", {
        method: "POST",
        body: { id: connection?.id, connection: toPayload(state) },
      }),
  })
  const remove = useMutation({
    mutationFn: () =>
      api(`/api/connections/${connection!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.add({ title: "Conexão excluída", type: "success" })
      void queryClient.invalidateQueries({ queryKey: ["connections"] })
      router.push("/connections")
    },
    onError: (error) =>
      toast.add({
        title: "Não foi possível excluir",
        description: errorMessage(error),
        type: "error",
      }),
  })
  const errors = fieldErrors(save.error)

  return (
    <form
      className="flex max-w-3xl flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <Alert>
        <ShieldAlertIcon />
        <AlertTitle>
          Use um usuário de banco só com permissão de leitura
        </AlertTitle>
        <AlertDescription>
          O sqlboard roda as queries em transação somente leitura, com tempo e
          linhas limitados, mas a defesa principal é um usuário com apenas{" "}
          <code>SELECT</code> (de preferência com{" "}
          <code>default_transaction_read_only = on</code>). Transação somente
          leitura sozinha não basta: extensões como <code>dblink</code> abrem
          outra conexão.
        </AlertDescription>
      </Alert>

      <FieldSet>
        <FieldLegend>Identificação</FieldLegend>
        <FieldGroup>
          <Field data-invalid={errors.name ? true : undefined}>
            <FieldLabel htmlFor="conn-name">Nome</FieldLabel>
            <Input
              id="conn-name"
              value={state.name}
              onChange={(e) => set("name", e.target.value)}
              aria-invalid={errors.name ? true : undefined}
              required
            />
            {errors.name ? <FieldError>{errors.name}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="conn-description">Descrição</FieldLabel>
            <Textarea
              id="conn-description"
              value={state.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Para que serve, quem cuida do banco…"
              rows={2}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="conn-dialect">Banco</FieldLabel>
              <SimpleSelect
                id="conn-dialect"
                items={DIALECTS.map((d) => ({
                  value: d,
                  label: DIALECT_LABELS[d],
                }))}
                value={state.dialect}
                onValueChange={(dialect) =>
                  setState((prev) => ({
                    ...prev,
                    dialect,
                    port: DEFAULT_PORTS[dialect]
                      ? String(DEFAULT_PORTS[dialect])
                      : "",
                  }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="conn-purpose">Uso</FieldLabel>
              <SimpleSelect
                id="conn-purpose"
                items={PURPOSES.map((p) => ({
                  value: p,
                  label: PURPOSE_LABELS[p],
                }))}
                value={state.purpose}
                onValueChange={(purpose) => set("purpose", purpose)}
              />
            </Field>
          </div>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Acesso ao banco</FieldLegend>
        <FieldGroup>
          {!isSqlite ? (
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <Field data-invalid={errors.host ? true : undefined}>
                <FieldLabel htmlFor="conn-host">Host</FieldLabel>
                <Input
                  id="conn-host"
                  value={state.host}
                  onChange={(e) => set("host", e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={errors.host ? true : undefined}
                />
                {errors.host ? <FieldError>{errors.host}</FieldError> : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="conn-port">Porta</FieldLabel>
                <Input
                  id="conn-port"
                  inputMode="numeric"
                  value={state.port}
                  onChange={(e) =>
                    set("port", e.target.value.replace(/\D/g, ""))
                  }
                />
              </Field>
            </div>
          ) : null}
          <Field data-invalid={errors.database ? true : undefined}>
            <FieldLabel htmlFor="conn-database">
              {isSqlite ? "Arquivo do banco" : "Banco de dados"}
            </FieldLabel>
            <Input
              id="conn-database"
              value={state.database}
              onChange={(e) => set("database", e.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={errors.database ? true : undefined}
            />
            {isSqlite ? (
              <FieldDescription>
                Nome do arquivo dentro da pasta de bancos SQLite do servidor
                (SQLBOARD_SQLITE_DIR); ele é aberto somente para leitura.
              </FieldDescription>
            ) : null}
            {errors.database ? (
              <FieldError>{errors.database}</FieldError>
            ) : null}
          </Field>
          {!isSqlite ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="conn-user">Usuário</FieldLabel>
                <Input
                  id="conn-user"
                  value={state.username}
                  onChange={(e) => set("username", e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="conn-password">Senha</FieldLabel>
                <Input
                  id="conn-password"
                  type="password"
                  value={state.password}
                  onChange={(e) => set("password", e.target.value)}
                  autoComplete="new-password"
                  placeholder={
                    connection?.hasPassword && !state.clearPassword
                      ? "Senha definida (deixe vazio para manter)"
                      : ""
                  }
                />
                {connection?.hasPassword ? (
                  <FieldDescription>
                    A senha nunca é exibida; ao mudar servidor, porta, usuário
                    ou SSL, digite-a de novo.{" "}
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto px-0"
                      onClick={() => set("clearPassword", !state.clearPassword)}
                    >
                      {state.clearPassword
                        ? "Manter a senha atual"
                        : "Remover a senha"}
                    </Button>
                  </FieldDescription>
                ) : null}
              </Field>
            </div>
          ) : null}
          {!isSqlite ? (
            <Field>
              <FieldLabel htmlFor="conn-ssl">SSL</FieldLabel>
              <SimpleSelect
                id="conn-ssl"
                items={SSL_MODES.map((m) => ({
                  value: m,
                  label: SSL_LABELS[m],
                }))}
                value={state.ssl}
                onValueChange={(ssl) => set("ssl", ssl)}
              />
            </Field>
          ) : null}
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Limites</FieldLegend>
        <FieldGroup className="grid gap-4 sm:grid-cols-3">
          <Field data-invalid={errors.statementTimeoutMs ? true : undefined}>
            <FieldLabel htmlFor="conn-timeout">Tempo limite (s)</FieldLabel>
            <Input
              id="conn-timeout"
              inputMode="numeric"
              value={state.statementTimeoutSec}
              onChange={(e) =>
                set(
                  "statementTimeoutSec",
                  e.target.value.replace(/[^\d.]/g, "")
                )
              }
            />
            {errors.statementTimeoutMs ? (
              <FieldError>{errors.statementTimeoutMs}</FieldError>
            ) : null}
          </Field>
          <Field data-invalid={errors.defaultRowLimit ? true : undefined}>
            <FieldLabel htmlFor="conn-default-limit">
              Linhas (padrão)
            </FieldLabel>
            <Input
              id="conn-default-limit"
              inputMode="numeric"
              value={state.defaultRowLimit}
              onChange={(e) =>
                set("defaultRowLimit", e.target.value.replace(/\D/g, ""))
              }
            />
            {errors.defaultRowLimit ? (
              <FieldError>{errors.defaultRowLimit}</FieldError>
            ) : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="conn-max-limit">Linhas (máximo)</FieldLabel>
            <Input
              id="conn-max-limit"
              inputMode="numeric"
              value={state.maxRowLimit}
              onChange={(e) =>
                set("maxRowLimit", e.target.value.replace(/\D/g, ""))
              }
            />
          </Field>
        </FieldGroup>
      </FieldSet>

      <div aria-live="polite" className="flex flex-col gap-2">
        {save.isError && !Object.keys(errors).length ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(save.error)}</AlertDescription>
          </Alert>
        ) : null}
        {test.isSuccess ? (
          <Alert>
            <PlugZapIcon />
            <AlertTitle>Conexão bem-sucedida</AlertTitle>
          </Alert>
        ) : null}
        {test.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Falha ao conectar</AlertTitle>
            <AlertDescription>{errorMessage(test.error)}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Spinner data-icon="inline-start" /> : null}
          Salvar
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={test.isPending}
          onClick={() => test.mutate()}
        >
          {test.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <PlugZapIcon data-icon="inline-start" />
          )}
          Testar conexão
        </Button>
        {connection ? (
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  variant="destructive"
                  className="sm:ml-auto"
                />
              }
            >
              <Trash2Icon data-icon="inline-start" />
              Excluir
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Excluir a conexão “{connection.name}”?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Queries salvas desta conexão também serão excluídas. Esta ação
                  não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => remove.mutate()}
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </form>
  )
}
