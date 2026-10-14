import "server-only"

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import {
  allIdentifiers,
  shortId,
  type AppDocument,
  type AppQuery,
} from "@/lib/app-schema"
import {
  documentJsonSchema,
  SCREEN_RULES,
  widgetCatalog,
} from "@/lib/ai-prompt/screen"
import { rawValueSchema } from "@/lib/queries/execute-schema"
import { syncParams, type SqlDialect } from "@/lib/sql-params"
import { widgetVariables } from "@/lib/widgets/registry"
import { generateScreen } from "@/lib/widgets/suggest"
import type { CurrentUser } from "@/server/auth/session"
import { executeQuery } from "@/server/execution/execute"
import { HttpError } from "@/server/http"
import { importAppFile } from "@/server/services/app-transfer"
import {
  createApp,
  getAppForEdit,
  listApps,
  saveDraft,
} from "@/server/services/apps"
import {
  getSchema,
  getUsableConnection,
  listConnections,
} from "@/server/services/connections"

/** Rows returned to the agent per query (the full result stays in sqlboard). */
const MCP_MAX_ROWS = 200

type ToolResult = {
  content: { type: "text"; text: string }[]
  isError?: boolean
}

const text = (value: unknown): ToolResult => ({
  content: [
    {
      type: "text",
      text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
    },
  ],
})

/** Service errors become tool errors with the same pt-BR message. */
async function safe(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return text(await fn())
  } catch (error) {
    if (error instanceof HttpError) {
      return {
        ...text(
          error.details
            ? { error: error.message, details: error.details }
            : error.message
        ),
        isError: true,
      }
    }
    if (error instanceof z.ZodError) {
      return {
        ...text({
          error: "Dados inválidos.",
          details: error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        }),
        isError: true,
      }
    }
    console.error("[mcp]", error)
    return { ...text("Erro interno."), isError: true }
  }
}

const appUrl = (id: string) =>
  `${process.env.BETTER_AUTH_URL ?? ""}/apps/${id}/edit`

/**
 * MCP server for agents (F6). Every tool calls the same services as the API,
 * as the token's user: same role, connection and screen permissions. Agents
 * create and edit drafts; publishing stays a human decision in the UI.
 */
export function createMcpServer(user: CurrentUser) {
  const server = new McpServer({ name: "sqlboard", version: "1.0.0" })

  server.registerTool(
    "list_connections",
    {
      description:
        "Lista as conexões de leitura que você pode usar (id, nome, banco).",
      annotations: { readOnlyHint: true },
    },
    () =>
      safe(async () =>
        (await listConnections(user, "read")).map((c) => ({
          id: c.id,
          name: c.name,
          dialect: c.dialect,
          description: c.description,
        }))
      )
  )

  server.registerTool(
    "get_schema",
    {
      description:
        "Tabelas, views, colunas, chaves e índices de uma conexão (do cache; refresh=true lê de novo).",
      inputSchema: { connectionId: z.uuid(), refresh: z.boolean().optional() },
      annotations: { readOnlyHint: true },
    },
    ({ connectionId, refresh }) =>
      safe(() => getSchema(user, connectionId, refresh ?? false))
  )

  server.registerTool(
    "run_query",
    {
      description: `Roda um SELECT somente leitura (parâmetros :nome com valores separados). Devolve até ${MCP_MAX_ROWS} linhas.`,
      inputSchema: {
        connectionId: z.uuid(),
        sql: z.string().min(1).max(200_000),
        values: z.record(z.string(), rawValueSchema).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    ({ connectionId, sql, values }) =>
      safe(async () => {
        if (user.role === "viewer") {
          throw new HttpError(403, "Leitores não rodam SQL livre.")
        }
        const connection = await getUsableConnection(user, connectionId)
        const result = await executeQuery({
          user,
          connection,
          sql,
          values: values ?? {},
          source: "mcp",
          maxRows: MCP_MAX_ROWS,
        })
        return {
          columns: result.columns,
          rows: result.rows,
          rowCount: result.rowCount,
          truncated: result.truncated,
          durationMs: result.durationMs,
        }
      })
  )

  server.registerTool(
    "list_apps",
    {
      description: "Lista as telas que você pode ver ou editar.",
      inputSchema: { q: z.string().max(200).optional() },
      annotations: { readOnlyHint: true },
    },
    ({ q }) => safe(() => listApps(user, { q }))
  )

  server.registerTool(
    "get_app",
    {
      description:
        "Documento JSON do rascunho de uma tela que você edita (queries, páginas e componentes).",
      inputSchema: { appId: z.uuid() },
      annotations: { readOnlyHint: true },
    },
    ({ appId }) => safe(() => getAppForEdit(user, appId))
  )

  server.registerTool(
    "document_format",
    {
      description:
        "Formato do documento de tela: regras, componentes e JSON Schema. Leia antes de criar ou editar telas.",
      annotations: { readOnlyHint: true },
    },
    () =>
      safe(async () =>
        [
          SCREEN_RULES.join("\n"),
          "",
          "Componentes:",
          widgetCatalog(),
          "",
          "JSON Schema:",
          JSON.stringify(documentJsonSchema()),
        ].join("\n")
      )
  )

  server.registerTool(
    "create_app",
    {
      description:
        "Cria uma tela (rascunho). Sem document, cria vazia; com document, valida e usa o documento.",
      inputSchema: {
        name: z.string().min(1).max(120),
        description: z.string().max(4000).optional(),
        document: z.record(z.string(), z.unknown()).optional(),
      },
    },
    ({ name, description, document }) =>
      safe(async () => {
        if (!document) {
          const { id } = await createApp(user, { name, description })
          return { id, url: appUrl(id) }
        }
        const doc = document as { app?: Record<string, unknown> }
        const file = {
          ...doc,
          app: {
            ...(doc.app ?? {}),
            id: crypto.randomUUID(),
            name,
            ...(description ? { description } : {}),
          },
        }
        const { id } = await importAppFile(user, { file })
        return { id, url: appUrl(id) }
      })
  )

  server.registerTool(
    "update_app_draft",
    {
      description:
        "Substitui o rascunho de uma tela pelo documento enviado (validado; conexões precisam ser suas).",
      inputSchema: {
        appId: z.uuid(),
        document: z.record(z.string(), z.unknown()),
      },
    },
    ({ appId, document }) =>
      safe(async () => {
        await saveDraft(user, appId, document)
        return { id: appId, url: appUrl(appId) }
      })
  )

  server.registerTool(
    "generate_screen",
    {
      description:
        "Adiciona uma query à tela e gera automaticamente filtros, KPIs, gráfico e tabela a partir das colunas do resultado.",
      inputSchema: {
        appId: z.uuid(),
        connectionId: z.uuid(),
        queryName: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
        sql: z.string().min(1).max(200_000),
        sampleValues: z.record(z.string(), rawValueSchema).optional(),
      },
    },
    ({ appId, connectionId, queryName, sql, sampleValues }) =>
      safe(async () => {
        const app = await getAppForEdit(user, appId)
        const connection = await getUsableConnection(user, connectionId)
        const document: AppDocument = structuredClone(app.document)
        if (document.queries.some((q) => q.name === queryName)) {
          throw new HttpError(400, `Já existe uma query “${queryName}”.`)
        }
        const query: AppQuery = {
          id: shortId("q"),
          name: queryName,
          connectionId,
          sql,
          params: syncParams(sql, [], connection.dialect as SqlDialect),
          runMode: "auto",
          sourceQueryId: null,
          cacheTtlSeconds: 0,
          paramBindings: {},
        }
        const result = await executeQuery({
          user,
          connection,
          sql,
          params: query.params,
          values: sampleValues ?? {},
          source: "mcp",
          appId,
          queryName,
          maxRows: MCP_MAX_ROWS,
        })
        const page = document.pages[0]!
        const widgets = generateScreen(query, result.columns, result.rowCount, {
          startY: page.widgets.reduce(
            (max, w) => Math.max(max, w.grid.y + w.grid.h),
            0
          ),
          taken: allIdentifiers(document),
          existingVariables: page.widgets.flatMap((w) => widgetVariables(w)),
        })
        document.queries.push(query)
        page.widgets.push(...widgets)
        await saveDraft(user, appId, document)
        return {
          id: appId,
          url: appUrl(appId),
          query: { name: query.name, params: query.params },
          widgets: widgets.map((w) => ({ id: w.id, type: w.type })),
        }
      })
  )

  return server
}
