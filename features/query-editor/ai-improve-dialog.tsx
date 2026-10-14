"use client"

import * as React from "react"
import {
  CheckCircle2Icon,
  ClipboardCopyIcon,
  DownloadIcon,
  GitCompareArrowsIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import {
  buildAiPrompt,
  checkImprovedQuery,
  compareRuns,
  hasTopLevelOrderBy,
  DEFAULT_INCLUDE,
  extractSqlFromResponse,
  referencedTables,
  type PromptInclude,
} from "@/lib/ai-prompt"
import { api, errorMessage } from "@/lib/api-client"
import type { SchemaInfo } from "@/lib/data-types"
import { formatCount, formatDuration } from "@/lib/format"
import type {
  ParamDefinition,
  RawParamValues,
  SqlDialect,
} from "@/lib/sql-params"

import { SqlDiff } from "./sql-diff"
import type { ExecutionResult } from "./use-execution"

const INCLUDE_LABELS: Record<keyof PromptInclude, string> = {
  version: "Banco e versão",
  tables: "Tabelas e views referenciadas (colunas, chaves e índices)",
  params: "Parâmetros e tipos",
  metrics: "Métricas da última execução",
  plan: "Plano de execução (EXPLAIN sem ANALYZE; pode mostrar os valores dos parâmetros)",
}

type CompareState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "error"; message: string }
  | { status: "done"; original: ExecutionResult; improved: ExecutionResult }

export function AiImproveDialog({
  sql,
  dialect,
  connectionId,
  schema,
  params,
  values,
  lastRun,
  onApply,
}: {
  sql: string
  dialect: SqlDialect
  connectionId: string | null
  schema?: SchemaInfo | null
  params: ParamDefinition[]
  values: RawParamValues
  lastRun?: { durationMs: number; rowCount: number; truncated: boolean }
  onApply: (sql: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [tab, setTab] = React.useState("copy")
  const [include, setInclude] = React.useState<PromptInclude>(DEFAULT_INCLUDE)
  const [plan, setPlan] = React.useState<{
    status: "idle" | "loading" | "error" | "done"
    text?: string
  }>({
    status: "idle",
  })
  const [response, setResponse] = React.useState("")
  const [compare, setCompare] = React.useState<CompareState>({ status: "idle" })

  const tables = React.useMemo(
    () => (schema ? referencedTables(sql, schema.tables, dialect) : []),
    [schema, sql, dialect]
  )
  const prompt = React.useMemo(
    () =>
      buildAiPrompt({
        sql,
        dialect,
        context: {
          serverVersion: schema?.serverVersion,
          tables,
          params,
          lastRun,
          plan: plan.text,
        },
        include,
      }),
    [sql, dialect, schema, tables, params, lastRun, plan.text, include]
  )
  const improved = React.useMemo(
    () => extractSqlFromResponse(response),
    [response]
  )
  const check = React.useMemo(
    () => (response.trim() ? checkImprovedQuery(sql, improved, dialect) : null),
    [response, sql, improved, dialect]
  )

  async function loadPlan() {
    if (!connectionId) return
    setPlan({ status: "loading" })
    try {
      const result = await api<{ plan: string }>("/api/explain", {
        method: "POST",
        body: { connectionId, sql, params, values },
      })
      setPlan({ status: "done", text: result.plan })
    } catch (error) {
      setPlan({ status: "error", text: undefined })
      toast.add({
        title: "Não foi possível obter o plano",
        description: errorMessage(error),
        type: "error",
      })
      setInclude((prev) => ({ ...prev, plan: false }))
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt)
      toast.add({
        title: "Prompt copiado",
        description: "Cole na IA de sua preferência.",
        type: "success",
      })
    } catch {
      toast.add({
        title: "Não foi possível copiar",
        description:
          "Selecione o texto do campo e copie manualmente (a área de transferência exige HTTPS).",
        type: "warning",
      })
    }
  }

  function downloadPrompt() {
    const blob = new Blob([prompt], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "prompt-sqlboard.txt"
    link.click()
    URL.revokeObjectURL(url)
  }

  async function runComparison() {
    if (!connectionId) return
    setCompare({ status: "running" })
    try {
      const body = { connectionId, params, values, source: "compare" as const }
      const original = await api<ExecutionResult>("/api/execute", {
        method: "POST",
        body: { ...body, sql },
      })
      const better = await api<ExecutionResult>("/api/execute", {
        method: "POST",
        body: { ...body, sql: improved },
      })
      setCompare({ status: "done", original, improved: better })
    } catch (error) {
      setCompare({ status: "error", message: errorMessage(error) })
    }
  }

  const verdict =
    compare.status === "done"
      ? compareRuns(compare.original, compare.improved, {
          ordered: hasTopLevelOrderBy(sql, dialect),
        })
      : null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setCompare({ status: "idle" })
      }}
    >
      <DialogTrigger
        render={<Button variant="outline" size="sm" disabled={!sql.trim()} />}
      >
        <SparklesIcon data-icon="inline-start" />
        Melhorar com IA
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Melhorar com IA</DialogTitle>
          <DialogDescription>
            Copie o prompt, cole em qualquer IA de chat (ChatGPT, Claude,
            Codex…) e traga a resposta de volta. Nenhum dado do resultado, senha
            ou endereço do banco vai no texto.
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(String(value))}
          className="flex flex-col gap-4"
        >
          <TabsList>
            <TabsTrigger value="copy">1. Copiar prompt</TabsTrigger>
            <TabsTrigger value="paste">2. Colar query melhorada</TabsTrigger>
          </TabsList>
          <TabsContent value="copy" className="flex flex-col gap-4">
            <FieldSet>
              <FieldLegend variant="label">Contexto incluído</FieldLegend>
              <FieldGroup className="gap-2">
                {(Object.keys(INCLUDE_LABELS) as (keyof PromptInclude)[]).map(
                  (key) => (
                    <Field key={key} orientation="horizontal">
                      <Checkbox
                        id={`ai-include-${key}`}
                        checked={include[key]}
                        onCheckedChange={(checked) => {
                          setInclude((prev) => ({
                            ...prev,
                            [key]: Boolean(checked),
                          }))
                          if (
                            key === "plan" &&
                            checked &&
                            plan.status !== "done"
                          )
                            void loadPlan()
                        }}
                      />
                      <FieldLabel
                        htmlFor={`ai-include-${key}`}
                        className="font-normal"
                      >
                        {INCLUDE_LABELS[key]}
                        {key === "plan" && plan.status === "loading" ? (
                          <Spinner />
                        ) : null}
                        {key === "tables" ? (
                          <Badge variant="secondary">{tables.length}</Badge>
                        ) : null}
                      </FieldLabel>
                    </Field>
                  )
                )}
              </FieldGroup>
            </FieldSet>
            <Field>
              <FieldLabel htmlFor="ai-prompt-text">Prompt</FieldLabel>
              <Textarea
                id="ai-prompt-text"
                readOnly
                value={prompt}
                rows={10}
                className="font-mono text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button onClick={copyPrompt}>
                <ClipboardCopyIcon data-icon="inline-start" />
                Copiar
              </Button>
              <Button variant="outline" onClick={downloadPrompt}>
                <DownloadIcon data-icon="inline-start" />
                Baixar .txt
              </Button>
              <Button variant="ghost" onClick={() => setTab("paste")}>
                Já tenho a resposta
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="paste" className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="ai-response">Resposta da IA</FieldLabel>
              <Textarea
                id="ai-response"
                rows={6}
                className="font-mono text-xs"
                placeholder={"```sql\nselect ...\n```"}
                value={response}
                onChange={(e) => {
                  setResponse(e.target.value)
                  setCompare({ status: "idle" })
                }}
              />
            </Field>
            {check ? (
              <div className="flex flex-col gap-2" aria-live="polite">
                {check.errors.map((error) => (
                  <Alert key={error} variant="destructive">
                    <TriangleAlertIcon />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ))}
                {check.warnings.map((warning) => (
                  <Alert key={warning}>
                    <TriangleAlertIcon />
                    <AlertDescription>{warning}</AlertDescription>
                  </Alert>
                ))}
                {check.ok && !check.warnings.length ? (
                  <Alert>
                    <CheckCircle2Icon />
                    <AlertDescription>
                      Um único comando, com os mesmos parâmetros e cláusulas
                      opcionais.
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            ) : null}
            {check?.ok ? <SqlDiff original={sql} improved={improved} /> : null}
            {check?.ok ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={runComparison}
                    disabled={!connectionId || compare.status === "running"}
                  >
                    {compare.status === "running" ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <GitCompareArrowsIcon data-icon="inline-start" />
                    )}
                    Comparar execução
                  </Button>
                  <Button
                    onClick={() => {
                      onApply(improved)
                      setOpen(false)
                      setResponse("")
                    }}
                  >
                    Aplicar
                  </Button>
                </div>
                {compare.status === "error" ? (
                  <Alert variant="destructive">
                    <AlertDescription>{compare.message}</AlertDescription>
                  </Alert>
                ) : null}
                {compare.status === "done" && verdict ? (
                  <div className="flex flex-col gap-2" aria-live="polite">
                    <Alert
                      variant={
                        verdict.verdict === "different"
                          ? "destructive"
                          : "default"
                      }
                    >
                      {verdict.verdict === "identical" ? (
                        <CheckCircle2Icon />
                      ) : (
                        <TriangleAlertIcon />
                      )}
                      <AlertTitle>
                        {verdict.verdict === "identical"
                          ? "Resultados idênticos"
                          : verdict.verdict === "different"
                            ? "Resultados diferentes"
                            : "Comparação inconclusiva"}
                      </AlertTitle>
                      {verdict.reasons.length ? (
                        <AlertDescription>
                          {verdict.reasons.join(" ")}
                        </AlertDescription>
                      ) : null}
                    </Alert>
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead />
                            <TableHead>Tempo</TableHead>
                            <TableHead>Linhas</TableHead>
                            <TableHead>Colunas</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(
                            [
                              ["Original", compare.original],
                              ["Melhorada", compare.improved],
                            ] as const
                          ).map(([label, run]) => (
                            <TableRow key={label}>
                              <TableCell className="font-medium">
                                {label}
                              </TableCell>
                              <TableCell>
                                {formatDuration(run.durationMs)}
                              </TableCell>
                              <TableCell>
                                {formatCount(run.rowCount)}
                                {run.truncated ? " (truncado)" : ""}
                              </TableCell>
                              <TableCell>{run.columns.length}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
