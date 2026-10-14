/**
 * Texts that connect an external AI agent (Claude Code, Claude Desktop,
 * Codex, Cursor…) to sqlboard through the MCP server: the workflow the
 * server announces, the downloadable skill and each client's configuration.
 *
 * Pure module: no React, no server code. The token is only interpolated into
 * the snippets shown once to its owner; nothing here stores it.
 */

export const MCP_SERVER_NAME = "sqlboard"

/** Placeholder used in the snippets until a token is created. */
export const TOKEN_PLACEHOLDER = "<SEU_TOKEN>"

/** Step-by-step workflow, shared by the MCP server instructions and the skill. */
export const AGENT_WORKFLOW = [
  "1. `list_connections` para ver os bancos que você pode usar; `get_schema` para conhecer tabelas, colunas, chaves e índices antes de escrever SQL.",
  "2. Escreva um único SELECT somente leitura. Parâmetros viram campos da tela: use `:nome` (ex.: `where uf = :uf`). Trechos opcionais ficam entre `[[ ]]` e somem quando o parâmetro está vazio (ex.: `[[ and status = :status ]]`).",
  "3. Teste com `run_query` (passe valores de exemplo em `values`). Corrija até funcionar.",
  "4. Se a query for útil de novo, salve na biblioteca com `save_query` (nome, descrição e tags em português).",
  "5. Crie a tela com `create_app` (nome e descrição da finalidade) e devolva a `url` para a pessoa abrir: o construtor mostra cada mudança sua ao vivo.",
  "6. Para montar a tela rápido, `generate_screen` adiciona a query e cria filtros, KPIs, gráfico e tabela pelas colunas. Para controle fino: `add_query`, `add_page`, `add_widget`, `update_widget` e `remove_widget`.",
  '7. Componentes de dados ligam na query por `bindings.data = "{{nome_da_query.data}}"`. Campos de entrada (text-input, select, date-range…) gravam uma variável com o nome em `props.param`; o parâmetro `:uf` de qualquer query recebe a variável `uf`. Leia `document_format` antes de editar o documento inteiro com `update_app_draft`.',
  "8. Você só edita rascunhos. Publicar continua sendo uma decisão da pessoa, no botão Publicar do construtor.",
]

export const AGENT_RULES = [
  "Nunca coloque valores dentro do SQL: use parâmetros `:nome`.",
  "Um comando por query, somente leitura (SELECT/WITH). INSERT, UPDATE, DELETE e DDL são recusados.",
  "Nomes de queries e componentes: letras, números e _ (ex.: vendas_por_mes).",
  "Textos visíveis (títulos, rótulos, descrições) em português do Brasil.",
  "Prefira poucas telas bem explicadas: diga para que serve cada uma na descrição.",
]

/** Instructions announced by the MCP server on `initialize`. */
export function serverInstructions() {
  return [
    "sqlboard: queries SQL viram telas (tabelas, gráficos, KPIs e filtros).",
    "",
    "Fluxo recomendado:",
    ...AGENT_WORKFLOW,
    "",
    "Regras:",
    ...AGENT_RULES.map((rule) => `- ${rule}`),
  ].join("\n")
}

/** SKILL.md for agents that support skills (Claude Code, Claude Desktop…). */
export function skillMarkdown(baseUrl: string) {
  return `---
name: sqlboard
description: Cria queries SQL e telas (painéis com tabelas, gráficos, KPIs e filtros) no sqlboard pelo servidor MCP "${MCP_SERVER_NAME}". Use quando pedirem um relatório, painel, tela, dashboard ou consulta sobre os bancos conectados ao sqlboard.
---

# sqlboard

O sqlboard (${baseUrl || "seu servidor"}) transforma queries SQL em telas. Você trabalha pelas ferramentas do servidor MCP \`${MCP_SERVER_NAME}\`, com as mesmas permissões de quem criou o token.

## Fluxo

${AGENT_WORKFLOW.join("\n")}

## Regras

${AGENT_RULES.map((rule) => `- ${rule}`).join("\n")}

## Exemplos de pedidos

- "Crie uma tela com as vendas por mês e por categoria, com filtro de período."
- "Quais clientes compraram mais no último trimestre? Salve a query e monte uma tela."
- "Na tela Vendas, adicione um KPI com o ticket médio e um gráfico de pizza por forma de pagamento."

Ao terminar, diga o que foi criado e mande o link da tela.
`
}

export type AgentClient = {
  id: string
  label: string
  /** Where the snippet goes, in pt-BR. */
  where: string
  language: "bash" | "json" | "toml" | "text"
  snippet: string
  note?: string
}

/** Configuration of each supported client for the MCP endpoint `mcpUrl`. */
export function agentClients(mcpUrl: string, token: string): AgentClient[] {
  const auth = `Bearer ${token || TOKEN_PLACEHOLDER}`
  const json = (value: unknown) => JSON.stringify(value, null, 2)
  return [
    {
      id: "claude-code",
      label: "Claude Code",
      where: "Rode no terminal (uma vez):",
      language: "bash",
      snippet: `claude mcp add --transport http ${MCP_SERVER_NAME} ${mcpUrl} --header "Authorization: ${auth}"`,
      note: "Depois, dentro do Claude Code, peça por exemplo: “Use o sqlboard para criar uma tela de vendas por mês”.",
    },
    {
      id: "claude-desktop",
      label: "Claude Desktop",
      where:
        "Em Configurações › Desenvolvedor › Editar configuração (claude_desktop_config.json), e reinicie o app:",
      language: "json",
      snippet: json({
        mcpServers: {
          [MCP_SERVER_NAME]: {
            command: "npx",
            args: [
              "-y",
              "mcp-remote",
              mcpUrl,
              "--header",
              "Authorization:${SQLBOARD_AUTH}",
            ],
            env: { SQLBOARD_AUTH: auth },
          },
        },
      }),
      note: "Precisa do Node.js instalado (o mcp-remote faz a ponte para o servidor HTTP).",
    },
    {
      id: "codex",
      label: "Codex",
      where: "Em ~/.codex/config.toml:",
      language: "toml",
      snippet: `[mcp_servers.${MCP_SERVER_NAME}]\nurl = "${mcpUrl}"\nhttp_headers = { "Authorization" = "${auth}" }`,
    },
    {
      id: "cursor",
      label: "Cursor / VS Code",
      where:
        "No Cursor, em .cursor/mcp.json; no VS Code, em .vscode/mcp.json (troque mcpServers por servers):",
      language: "json",
      snippet: json({
        mcpServers: {
          [MCP_SERVER_NAME]: {
            type: "http",
            url: mcpUrl,
            headers: { Authorization: auth },
          },
        },
      }),
    },
    {
      id: "other",
      label: "Outro cliente",
      where: "Qualquer cliente MCP com transporte HTTP (Streamable HTTP):",
      language: "text",
      snippet: `Endereço: ${mcpUrl}\nCabeçalho: Authorization: ${auth}`,
      note: "O claude.ai no navegador exige login OAuth e endereço público; use o Claude Code ou o Claude Desktop.",
    },
  ]
}
