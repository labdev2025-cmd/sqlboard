"use client"

import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import {
  BotIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  KeyRoundIcon,
  PlugZapIcon,
} from "lucide-react"

import { CopyField } from "@/components/copy-field"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/toast"
import {
  agentClients,
  MCP_SERVER_NAME,
  skillMarkdown,
  TOKEN_PLACEHOLDER,
} from "@/lib/ai-connect"
import { api, errorMessage } from "@/lib/api-client"

const EXAMPLES = [
  "Use o sqlboard para criar uma tela com as vendas por mês e por categoria, com filtro de período.",
  "No sqlboard, descubra quais clientes mais compraram no último trimestre, salve a query na biblioteca e monte uma tela.",
  "Na tela “Vendas” do sqlboard, adicione um KPI com o ticket médio e um gráfico de pizza por forma de pagamento.",
]

/** Guides a person through connecting an AI agent to the MCP server. */
export function AiConnect({ origin }: { origin: string }) {
  const mcpUrl = `${origin}/api/mcp`
  const [token, setToken] = React.useState("")
  const clients = agentClients(mcpUrl, token.trim())

  const create = useMutation({
    mutationFn: () =>
      api<{ token: string }>("/api/tokens", {
        method: "POST",
        body: {
          name: `IA ${new Date().toLocaleDateString("pt-BR")}`,
          expiresInDays: 90,
        },
      }),
    onSuccess: (created) => setToken(created.token),
  })

  const check = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/mcp", {
        method: "POST",
        credentials: "omit",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2025-06-18",
          authorization: `Bearer ${token.trim()}`,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      })
      const body = (await response.json().catch(() => null)) as {
        result?: { tools?: unknown[] }
        error?: { message?: string }
      } | null
      if (!response.ok || !body?.result) {
        throw new Error(
          body?.error?.message ?? "O servidor não aceitou o token."
        )
      }
      return body.result.tools?.length ?? 0
    },
  })

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BotIcon className="size-5" />
            Como funciona
          </CardTitle>
          <CardDescription>
            Você conversa com a sua IA em português e ela trabalha no sqlboard
            por você, com os mesmos acessos que você tem.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
            <li>Gere um token e cole a configuração na sua IA (uma vez).</li>
            <li>
              Peça o que precisa: “crie uma tela de vendas por mês”, “quais
              clientes mais compraram?”.
            </li>
            <li>
              A IA lê o schema do banco, escreve e testa a query, salva na
              biblioteca e monta a tela com filtros, KPIs, gráficos e tabela.
            </li>
            <li>
              Abra o link que ela devolver: o construtor mostra cada mudança ao
              vivo. Ajuste o que quiser e clique em <strong>Publicar</strong>{" "}
              quando estiver bom (a IA não publica).
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>1. Token de acesso</CardTitle>
          <CardDescription>
            O token age em seu nome. Trate como senha; revogue em Tokens de API
            quando não usar mais.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {create.isError ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>
                  {errorMessage(create.error)}
                </AlertDescription>
              </Alert>
            ) : null}
            {create.data ? (
              <Alert>
                <KeyRoundIcon />
                <AlertTitle>Token criado (válido por 90 dias)</AlertTitle>
                <AlertDescription>
                  Ele já foi colocado nas configurações abaixo. Por segurança,
                  não será mostrado de novo depois que você sair da página.
                </AlertDescription>
              </Alert>
            ) : null}
            <Field>
              <FieldLabel htmlFor="ai-token">Token</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="ai-token"
                  className="font-mono"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="sqlb_…"
                  autoComplete="off"
                  spellCheck={false}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    variant="default"
                    onClick={() => create.mutate()}
                    disabled={create.isPending}
                  >
                    {create.isPending ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <KeyRoundIcon data-icon="inline-start" />
                    )}
                    Gerar token
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>
                Gere um novo ou cole um que você já tem.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="ai-mcp-url">
                Endereço do servidor MCP
              </FieldLabel>
              <CopyField id="ai-mcp-url" value={mcpUrl} label="Endereço MCP" />
              <FieldDescription>
                O servidor se chama “{MCP_SERVER_NAME}” e usa HTTP com o
                cabeçalho <code>Authorization: Bearer &lt;token&gt;</code>.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Configure a sua IA</CardTitle>
          <CardDescription>
            Escolha o aplicativo que você usa e copie a configuração.
            {token.trim()
              ? null
              : ` Sem token, o texto mostra ${TOKEN_PLACEHOLDER} no lugar dele.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={clients[0]!.id} className="flex flex-col gap-3">
            <div className="max-w-full [scrollbar-width:thin] overflow-x-auto overflow-y-hidden py-1">
              <TabsList className="w-max">
                {clients.map((client) => (
                  <TabsTrigger key={client.id} value={client.id}>
                    {client.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {clients.map((client) => (
              <TabsContent
                key={client.id}
                value={client.id}
                className="flex flex-col gap-2"
              >
                <p className="text-sm">{client.where}</p>
                <CopyBlock
                  code
                  text={client.snippet}
                  label={`Configuração do ${client.label}`}
                />
                {client.note ? (
                  <p className="text-sm text-muted-foreground">{client.note}</p>
                ) : null}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Teste a conexão</CardTitle>
          <CardDescription>
            Confere se o token funciona no servidor MCP antes de ir para a IA.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div>
            <Button
              variant="outline"
              onClick={() => check.mutate()}
              disabled={!token.trim() || check.isPending}
            >
              {check.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <PlugZapIcon data-icon="inline-start" />
              )}
              Testar conexão
            </Button>
          </div>
          <div aria-live="polite">
            {check.isSuccess ? (
              <Alert>
                <CheckIcon />
                <AlertTitle>Conectado</AlertTitle>
                <AlertDescription>
                  O servidor respondeu com {check.data} ferramentas disponíveis
                  para a IA.
                </AlertDescription>
              </Alert>
            ) : check.isError ? (
              <Alert variant="destructive">
                <AlertTitle>Não conectou</AlertTitle>
                <AlertDescription>{errorMessage(check.error)}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            4. Skill do sqlboard
            <Badge variant="secondary">opcional</Badge>
          </CardTitle>
          <CardDescription>
            Um roteiro que ensina a IA o jeito certo de trabalhar aqui: olhar o
            schema, testar a query, usar parâmetros e montar a tela. O servidor
            já envia esse roteiro; a skill ajuda a IA a lembrar dele sozinha.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div>
            <Button
              variant="outline"
              onClick={() => downloadSkill(skillMarkdown(origin))}
            >
              <DownloadIcon data-icon="inline-start" />
              Baixar SKILL.md
            </Button>
          </div>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>
              <strong>Claude Code:</strong> salve em{" "}
              <code>~/.claude/skills/sqlboard/SKILL.md</code>.
            </li>
            <li>
              <strong>Claude Desktop:</strong> compacte a pasta{" "}
              <code>sqlboard</code> com o arquivo dentro e envie em
              Configurações › Capacidades › Skills.
            </li>
            <li>
              <strong>Outras IAs:</strong> cole o conteúdo nas instruções do
              projeto ou no início da conversa.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5. Peça e acompanhe</CardTitle>
          <CardDescription>
            Exemplos para começar. Deixe a tela aberta no construtor para ver a
            IA trabalhando.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {EXAMPLES.map((example, index) => (
            <CopyBlock
              key={example}
              text={example}
              label={`Exemplo ${index + 1}`}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

/** Text with a "Copiar" button above it; code keeps its lines and scrolls. */
function CopyBlock({
  text,
  label,
  code = false,
}: {
  text: string
  label: string
  code?: boolean
}) {
  const [copied, setCopied] = React.useState(false)
  const ref = React.useRef<HTMLElement>(null)
  const Content = code ? "pre" : "p"
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border bg-muted/40 p-2">
      <div className="flex items-center justify-between gap-2 pl-1">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        <Button
          variant="outline"
          size="xs"
          aria-label={
            copied
              ? `${label}: copiado`
              : `Copiar ${label.charAt(0).toLowerCase()}${label.slice(1)}`
          }
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text)
              setCopied(true)
              toast.add({ title: "Copiado", type: "success" })
            } catch {
              const selection = window.getSelection()
              if (ref.current && selection) {
                selection.selectAllChildren(ref.current)
              }
              toast.add({
                title: "Não foi possível copiar",
                description: "O texto ficou selecionado: copie com Ctrl+C.",
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
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
      <Content
        ref={ref as never}
        aria-label={label}
        tabIndex={code ? 0 : undefined}
        className={
          code
            ? "max-w-full overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed whitespace-pre"
            : "px-1 pb-1 text-sm"
        }
      >
        {text}
      </Content>
    </div>
  )
}

function downloadSkill(markdown: string) {
  const url = URL.createObjectURL(
    new Blob([markdown], { type: "text/markdown;charset=utf-8" })
  )
  const link = document.createElement("a")
  link.href = url
  link.download = "SKILL.md"
  link.click()
  URL.revokeObjectURL(url)
}
