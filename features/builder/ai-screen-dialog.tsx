"use client"

import * as React from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { CheckIcon, CopyIcon, SparklesIcon } from "lucide-react"

import { PickerState } from "@/components/picker-state"
import { SimpleSelect } from "@/components/simple-select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import {
  buildScreenPrompt,
  parseScreenAnswer,
  ScreenAnswerError,
} from "@/lib/ai-prompt/screen"
import { api, errorMessage } from "@/lib/api-client"
import type { AppDocument } from "@/lib/app-schema"
import type { ConnectionView } from "@/lib/connections/schema"
import type { SchemaInfo } from "@/lib/data-types"
import type { SqlDialect } from "@/lib/sql-params"

/**
 * "Gerar com IA" by copy and paste: the prompt carries the request, the
 * schema of the chosen connection and the current document (never data
 * rows or credentials); the pasted answer is validated before it replaces
 * the draft, as one undoable change.
 */
export function AiScreenDialog({
  doc,
  onApply,
}: {
  doc: AppDocument
  onApply: (next: AppDocument) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [request, setRequest] = React.useState("")
  const [connectionId, setConnectionId] = React.useState<string | null>(
    doc.queries[0]?.connectionId ?? null
  )
  const [prompt, setPrompt] = React.useState("")
  const [copied, setCopied] = React.useState(false)
  const [answer, setAnswer] = React.useState("")
  const [problem, setProblem] = React.useState<ScreenAnswerError | null>(null)

  const connections = useQuery({
    queryKey: ["connections", "read"],
    queryFn: () => api<ConnectionView[]>("/api/connections?purpose=read"),
    enabled: open,
  })
  const build = useMutation({
    mutationFn: async () => {
      const connection = connections.data!.find((c) => c.id === connectionId)!
      const schema = await api<SchemaInfo>(
        `/api/connections/${connection.id}/schema`
      )
      return buildScreenPrompt({
        request,
        dialect: connection.dialect as SqlDialect,
        connectionId: connection.id,
        serverVersion: schema.serverVersion,
        tables: schema.tables,
        current: doc,
      })
    },
    onSuccess: (text) => {
      setPrompt(text)
      setCopied(false)
    },
  })

  function apply() {
    setProblem(null)
    try {
      const next = parseScreenAnswer(answer, { appId: doc.app.id })
      const allowed = new Set((connections.data ?? []).map((c) => c.id))
      const foreign = next.queries.filter((q) => !allowed.has(q.connectionId))
      if (foreign.length) {
        throw new ScreenAnswerError(
          `Queries com conexão que você não usa: ${foreign.map((q) => q.name).join(", ")}.`
        )
      }
      onApply(next)
      toast.add({
        title: "Tela gerada aplicada ao rascunho",
        description: "Confira e use Desfazer (Ctrl+Z) se não gostar.",
        type: "success",
      })
      setOpen(false)
    } catch (error) {
      setProblem(
        error instanceof ScreenAnswerError
          ? error
          : new ScreenAnswerError(errorMessage(error))
      )
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setPrompt("")
          setAnswer("")
          setProblem(null)
          build.reset()
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <SparklesIcon data-icon="inline-start" />
        Gerar com IA
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerar tela com IA</DialogTitle>
          <DialogDescription>
            Descreva a tela, copie o prompt para a IA que você usa e cole a
            resposta. Nenhum dado das tabelas vai no prompt, só a estrutura.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="ai-screen-request">
              1. O que a tela deve mostrar?
            </FieldLabel>
            <Textarea
              id="ai-screen-request"
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              rows={3}
              placeholder="Ex.: vendas por mês e por categoria, com filtro de período e de UF"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ai-screen-connection">Conexão</FieldLabel>
            <SimpleSelect
              id="ai-screen-connection"
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
              emptyText="Você não tem acesso a nenhuma conexão de leitura."
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!request.trim() || !connectionId || build.isPending}
              onClick={() => build.mutate()}
            >
              {build.isPending ? <Spinner data-icon="inline-start" /> : null}
              Montar prompt
            </Button>
            {prompt ? (
              <Button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(prompt)
                    setCopied(true)
                  } catch {
                    toast.add({
                      title: "Não foi possível copiar",
                      description:
                        "Selecione o texto do campo Prompt e copie com Ctrl+C.",
                      type: "error",
                    })
                  }
                }}
              >
                {copied ? (
                  <CheckIcon data-icon="inline-start" />
                ) : (
                  <CopyIcon data-icon="inline-start" />
                )}
                {copied ? "Copiado" : "Copiar prompt"}
              </Button>
            ) : null}
          </div>
          {build.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{errorMessage(build.error)}</AlertDescription>
            </Alert>
          ) : null}
          {prompt ? (
            <Field>
              <FieldLabel htmlFor="ai-screen-prompt">Prompt</FieldLabel>
              <Textarea
                id="ai-screen-prompt"
                value={prompt}
                readOnly
                rows={4}
                className="font-mono text-xs"
              />
            </Field>
          ) : null}
          <Field>
            <FieldLabel htmlFor="ai-screen-answer">
              2. Resposta da IA
            </FieldLabel>
            <Textarea
              id="ai-screen-answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={5}
              className="font-mono text-xs"
              placeholder="Cole aqui o bloco ```json``` devolvido pela IA"
            />
            <FieldDescription>
              O documento é validado antes de entrar no rascunho; publicar
              continua sendo uma decisão sua.
            </FieldDescription>
          </Field>
          {problem ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>
                <p>{problem.message}</p>
                {problem.issues.length ? (
                  <ul className="mt-1 list-disc pl-4">
                    {problem.issues.map((issue) => (
                      <li key={`${issue.path}-${issue.message}`}>
                        <code>{issue.path || "(documento)"}</code>:{" "}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
        </FieldGroup>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>
            Cancelar
          </DialogClose>
          <Button type="button" disabled={!answer.trim()} onClick={apply}>
            Aplicar ao rascunho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
