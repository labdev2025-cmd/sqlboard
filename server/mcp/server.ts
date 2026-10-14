import "server-only"

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import { serverInstructions } from "@/lib/ai-connect"
import {
  allIdentifiers,
  shortId,
  type AppDocument,
  type AppQuery,
  type Widget,
} from "@/lib/app-schema"
import { querySnapshot } from "@/lib/app-schema/snapshot"
import {
  documentJsonSchema,
  SCREEN_RULES,
  widgetCatalog,
} from "@/lib/ai-prompt/screen"
import { rawValueSchema } from "@/lib/queries/execute-schema"
import { syncParams, type SqlDialect } from "@/lib/sql-params"
import { bottomY, createWidget } from "@/lib/widgets/create"
import { WIDGET_TYPES, widgetVariables } from "@/lib/widgets/registry"
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
import {
  createSavedQuery,
  getSavedQuery,
  listSavedQueries,
} from "@/server/services/queries"

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

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/

const gridSchema = z
  .object({
    x: z.number().int().min(0).max(11).optional(),
    y: z.number().int().min(0).optional(),
    w: z.number().int().min(1).max(12).optional(),
    h: z.number().int().min(1).max(60).optional(),
  })
  .optional()

/**
 * Loads the draft, applies `fn` and saves it with the usual checks (schema,
 * connection access). The builder open on this screen picks the change up.
 */
async function editDraft<T>(
  user: CurrentUser,
  appId: string,
  fn: (document: AppDocument) => T | Promise<T>
) {
  const app = await getAppForEdit(user, appId)
  const document: AppDocument = structuredClone(app.document)
  const result = await fn(document)
  await saveDraft(user, appId, document, app.updatedAt)
  return { id: appId, url: appUrl(appId), ...result }
}

function pageOf(document: AppDocument, pageId?: string) {
  const page = pageId
    ? document.pages.find((p) => p.id === pageId)
    : document.pages[0]
  if (!page) throw new HttpError(404, `Página “${pageId}” não encontrada.`)
  return page
}

function widgetOf(document: AppDocument, widgetId: string) {
  for (const page of document.pages) {
    const index = page.widgets.findIndex((w) => w.id === widgetId)
    if (index >= 0) return { page, index, widget: page.widgets[index]! }
  }
  throw new HttpError(404, `Componente “${widgetId}” não encontrado.`)
}

/**
 * MCP server for agents (F6). Every tool calls the same services as the API,
 * as the token's user: same role, connection and screen permissions. Agents
 * create and edit drafts; publishing stays a human decision in the UI.
 */
export function createMcpServer(user: CurrentUser) {
  const server = new McpServer(
    { name: "sqlboard", version: "1.1.0" },
    { instructions: serverInstructions() }
  )

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
        queryName: z.string().regex(IDENTIFIER),
        sql: z.string().min(1).max(200_000),
        sampleValues: z.record(z.string(), rawValueSchema).optional(),
        pageId: z.string().optional(),
      },
    },
    ({ appId, connectionId, queryName, sql, sampleValues, pageId }) =>
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
        const page = pageOf(document, pageId)
        const widgets = generateScreen(query, result.columns, result.rowCount, {
          startY: bottomY(page),
          taken: allIdentifiers(document),
          existingVariables: page.widgets.flatMap((w) => widgetVariables(w)),
        })
        document.queries.push(query)
        page.widgets.push(...widgets)
        await saveDraft(user, appId, document, app.updatedAt)
        return {
          id: appId,
          url: appUrl(appId),
          query: { name: query.name, params: query.params },
          widgets: widgets.map((w) => ({ id: w.id, type: w.type })),
        }
      })
  )

  server.registerTool(
    "list_saved_queries",
    {
      description:
        "Lista as queries salvas na biblioteca (nome, descrição, tags, conexão e SQL).",
      inputSchema: { q: z.string().max(200).optional() },
      annotations: { readOnlyHint: true },
    },
    ({ q }) =>
      safe(async () =>
        (await listSavedQueries(user, { q })).map((query) => ({
          id: query.id,
          name: query.name,
          description: query.description,
          tags: query.tags,
          connectionId: query.connectionId,
          connectionName: query.connectionName,
          sql: query.sql,
          params: query.params,
        }))
      )
  )

  server.registerTool(
    "save_query",
    {
      description:
        "Salva uma query na biblioteca (parâmetros :nome detectados e tipados automaticamente). Teste antes com run_query.",
      inputSchema: {
        connectionId: z.uuid(),
        name: z.string().min(1).max(120),
        description: z.string().max(2000).optional(),
        tags: z.array(z.string().max(40)).max(20).optional(),
        sql: z.string().min(1).max(200_000),
      },
    },
    ({ connectionId, name, description, tags, sql }) =>
      safe(async () => {
        const connection = await getUsableConnection(user, connectionId)
        const saved = await createSavedQuery(user, {
          connectionId,
          name,
          description: description ?? "",
          tags: tags ?? [],
          sql,
          params: syncParams(sql, [], connection.dialect as SqlDialect),
        })
        return {
          id: saved.id,
          name: saved.name,
          params: saved.params,
          url: `${process.env.BETTER_AUTH_URL ?? ""}/queries/${saved.id}`,
        }
      })
  )

  server.registerTool(
    "add_query",
    {
      description:
        "Adiciona uma query à tela, sem criar componentes: com connectionId + sql, ou copiando uma query da biblioteca (savedQueryId).",
      inputSchema: {
        appId: z.uuid(),
        name: z.string().regex(IDENTIFIER).optional(),
        connectionId: z.uuid().optional(),
        sql: z.string().min(1).max(200_000).optional(),
        savedQueryId: z.uuid().optional(),
        runMode: z.enum(["auto", "manual"]).optional(),
      },
    },
    ({ appId, name, connectionId, sql, savedQueryId, runMode }) =>
      safe(() =>
        editDraft(user, appId, async (document) => {
          const taken = allIdentifiers(document)
          let query: AppQuery
          if (savedQueryId) {
            query = querySnapshot(
              await getSavedQuery(user, savedQueryId),
              taken
            )
            if (name) query.name = name
          } else {
            if (!connectionId || !sql || !name) {
              throw new HttpError(
                400,
                "Informe name, connectionId e sql (ou savedQueryId)."
              )
            }
            const connection = await getUsableConnection(user, connectionId)
            query = {
              id: shortId("q"),
              name,
              connectionId,
              sql,
              params: syncParams(sql, [], connection.dialect as SqlDialect),
              runMode: "auto",
              sourceQueryId: null,
              cacheTtlSeconds: 0,
              paramBindings: {},
            }
          }
          if (runMode) query.runMode = runMode
          if (taken.includes(query.name)) {
            throw new HttpError(400, `O nome “${query.name}” já está em uso.`)
          }
          document.queries.push(query)
          return {
            query: { id: query.id, name: query.name, params: query.params },
          }
        })
      )
  )

  server.registerTool(
    "add_page",
    {
      description: "Adiciona uma página à tela e devolve o pageId.",
      inputSchema: { appId: z.uuid(), name: z.string().min(1).max(80) },
    },
    ({ appId, name }) =>
      safe(() =>
        editDraft(user, appId, (document) => {
          const id = shortId("p")
          document.pages.push({
            id,
            name,
            layout: { cols: 12, rowHeight: 40 },
            widgets: [],
          })
          return { pageId: id }
        })
      )
  )

  server.registerTool(
    "add_widget",
    {
      description:
        "Adiciona um componente (veja os tipos e propriedades em document_format). Com query, liga os dados a {{query.data}}. Sem grid, entra abaixo dos outros.",
      inputSchema: {
        appId: z.uuid(),
        type: z.enum(WIDGET_TYPES as [string, ...string[]]),
        pageId: z.string().optional(),
        query: z.string().regex(IDENTIFIER).optional(),
        props: z.record(z.string(), z.unknown()).optional(),
        bindings: z.record(z.string(), z.string()).optional(),
        grid: gridSchema,
      },
    },
    ({ appId, type, pageId, query, props, bindings, grid }) =>
      safe(() =>
        editDraft(user, appId, (document) => {
          const page = pageOf(document, pageId)
          if (query && !document.queries.some((q) => q.name === query)) {
            throw new HttpError(404, `Query “${query}” não existe na tela.`)
          }
          const widget = createWidget(
            document,
            page,
            type as Widget["type"],
            grid,
            query
          )
          widget.props = { ...widget.props, ...props } as never
          widget.bindings = { ...widget.bindings, ...bindings }
          page.widgets.push(widget)
          return { widget: { id: widget.id, type, grid: widget.grid } }
        })
      )
  )

  server.registerTool(
    "update_widget",
    {
      description:
        "Altera um componente: props e bindings são mesclados; grid muda posição/tamanho.",
      inputSchema: {
        appId: z.uuid(),
        widgetId: z.string(),
        props: z.record(z.string(), z.unknown()).optional(),
        bindings: z.record(z.string(), z.string()).optional(),
        grid: gridSchema,
      },
    },
    ({ appId, widgetId, props, bindings, grid }) =>
      safe(() =>
        editDraft(user, appId, (document) => {
          const { widget } = widgetOf(document, widgetId)
          widget.props = { ...widget.props, ...props } as never
          widget.bindings = { ...widget.bindings, ...bindings }
          widget.grid = { ...widget.grid, ...grid }
          return { widget: { id: widget.id, type: widget.type } }
        })
      )
  )

  server.registerTool(
    "remove_widget",
    {
      description: "Remove um componente da tela.",
      inputSchema: { appId: z.uuid(), widgetId: z.string() },
      annotations: { destructiveHint: true },
    },
    ({ appId, widgetId }) =>
      safe(() =>
        editDraft(user, appId, (document) => {
          const { page, index } = widgetOf(document, widgetId)
          page.widgets.splice(index, 1)
          return { removed: widgetId }
        })
      )
  )

  return server
}
