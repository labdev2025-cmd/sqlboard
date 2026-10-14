import { eq } from "drizzle-orm"
import { beforeAll, describe, expect, it } from "vitest"

import { POST } from "@/app/api/mcp/route"
import { db } from "@/server/db/client"
import { apiTokens, user as userTable } from "@/server/db/schema"
import { createToken, revokeToken } from "@/server/services/api-tokens"
import { getAppForEdit } from "@/server/services/apps"
import { createConnection, setAccess } from "@/server/services/connections"

import { demoConnectionInput, makeUser } from "../support/fixtures"

type User = Awaited<ReturnType<typeof makeUser>>
let admin: User, editor: User, viewer: User
let editorToken: string
let viewerToken: string
let connectionId: string
let nextId = 1

async function rpc(
  token: string | null,
  method: string,
  params: Record<string, unknown> = {}
) {
  const response = await POST(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-06-18",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
    })
  )
  return { status: response.status, body: await response.json() }
}

async function call(token: string, name: string, args: object = {}) {
  const { body } = await rpc(token, "tools/call", { name, arguments: args })
  const result = body.result as {
    content: { text: string }[]
    isError?: boolean
  }
  const raw = result.content[0]!.text
  let parsed: unknown = raw
  try {
    parsed = JSON.parse(raw)
  } catch {
    // plain text
  }
  return { isError: Boolean(result.isError), data: parsed as never }
}

beforeAll(async () => {
  admin = await makeUser("admin")
  editor = await makeUser("editor")
  viewer = await makeUser("viewer")
  connectionId = (
    await createConnection(admin, {
      ...demoConnectionInput,
      name: `MCP ${Date.now()}`,
    })
  ).id
  await setAccess(admin, connectionId, [editor.id])
  editorToken = (await createToken(editor, { name: "Agente" })).token
  viewerToken = (await createToken(viewer, { name: "Leitor" })).token
})

describe("servidor MCP", () => {
  it("exige token válido (sem cookie, sem token expirado ou revogado)", async () => {
    expect((await rpc(null, "tools/list")).status).toBe(401)
    expect((await rpc("sqlb_invalido", "tools/list")).status).toBe(401)
    const temp = await createToken(editor, { name: "Temporário" })
    await db
      .update(apiTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(apiTokens.id, temp.id))
    expect((await rpc(temp.token, "tools/list")).status).toBe(401)
    const revoked = await createToken(editor, { name: "Revogado" })
    await revokeToken(editor, revoked.id)
    expect((await rpc(revoked.token, "tools/list")).status).toBe(401)
    // The hash is stored, never the token.
    const [row] = await db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.id, temp.id))
    expect(row!.tokenHash).not.toContain(temp.token)
    expect(temp.token.startsWith(row!.prefix)).toBe(true)
  })

  it("inicializa e lista as ferramentas", async () => {
    const init = await rpc(editorToken, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "teste", version: "1" },
    })
    expect(init.status).toBe(200)
    expect(init.body.result.serverInfo.name).toBe("sqlboard")
    const { body } = await rpc(editorToken, "tools/list")
    const names = (body.result.tools as { name: string }[]).map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining([
        "list_connections",
        "get_schema",
        "run_query",
        "list_apps",
        "get_app",
        "document_format",
        "create_app",
        "update_app_draft",
        "generate_screen",
        "list_saved_queries",
        "save_query",
        "add_query",
        "add_page",
        "add_widget",
        "update_widget",
        "remove_widget",
      ])
    )
    // The workflow is announced to the client on initialize.
    expect(init.body.result.instructions).toContain("get_schema")
    expect(names).not.toContain("publish_app")
  })

  it("roda SQL com as permissões do dono do token", async () => {
    const connections = await call(editorToken, "list_connections")
    expect((connections.data as { id: string }[]).map((c) => c.id)).toContain(
      connectionId
    )
    const ok = await call(editorToken, "run_query", {
      connectionId,
      sql: "select uf, count(*) as total from loja.clientes where uf = :uf group by uf",
      values: { uf: "CE" },
    })
    expect(ok.isError).toBe(false)
    expect((ok.data as { rows: unknown[][] }).rows[0]![0]).toBe("CE")
    const write = await call(editorToken, "run_query", {
      connectionId,
      sql: "delete from loja.clientes",
    })
    expect(write.isError).toBe(true)
    const denied = await call(viewerToken, "run_query", {
      connectionId,
      sql: "select 1",
    })
    expect(denied.isError).toBe(true)
    // A disabled user's token stops working at once.
    await db
      .update(userTable)
      .set({ disabled: true })
      .where(eq(userTable.id, viewer.id))
    expect((await rpc(viewerToken, "tools/list")).status).toBe(401)
  })

  it("cria tela e gera componentes a partir de uma query", async () => {
    const created = await call(editorToken, "create_app", {
      name: `Tela do agente ${Date.now()}`,
    })
    expect(created.isError).toBe(false)
    const appId = (created.data as { id: string }).id
    const generated = await call(editorToken, "generate_screen", {
      appId,
      connectionId,
      queryName: "pedidos_status",
      sql: "select status, count(*) as pedidos from loja.pedidos where data_pedido >= :desde group by status",
      sampleValues: { desde: "2020-01-01" },
    })
    expect(generated.isError).toBe(false)
    const doc = (await getAppForEdit(editor, appId)).document
    expect(doc.queries.map((q) => q.name)).toEqual(["pedidos_status"])
    expect(doc.queries[0]!.params[0]).toMatchObject({
      name: "desde",
      type: "date",
    })
    const types = doc.pages[0]!.widgets.map((w) => w.type)
    expect(types).toContain("date-input")
    expect(types).toContain("bar-chart")
    expect(types).toContain("table")

    // Invalid documents are refused with details.
    const bad = await call(editorToken, "update_app_draft", {
      appId,
      document: { ...doc, pages: [] },
    })
    expect(bad.isError).toBe(true)
    // Foreign connection: refused.
    const other = (
      await createConnection(admin, {
        ...demoConnectionInput,
        name: `Sem acesso ${Date.now()}`,
      })
    ).id
    const sneaky = structuredClone(doc)
    sneaky.queries[0]!.connectionId = other
    expect(
      (await call(editorToken, "update_app_draft", { appId, document: sneaky }))
        .isError
    ).toBe(true)
    const format = await call(editorToken, "document_format")
    expect(String(format.data)).toContain("JSON Schema")
  })

  it("monta uma tela passo a passo: biblioteca, query, página e componentes", async () => {
    const reader = await makeUser("viewer")
    const readerToken = (await createToken(reader, { name: "Leitor 2" })).token
    const sql =
      "select uf, count(*) as total from loja.clientes [[ where uf = :uf ]] group by uf order by uf"
    const saved = await call(editorToken, "save_query", {
      connectionId,
      name: "Clientes por UF (MCP)",
      description: "Quantidade de clientes por estado.",
      tags: ["clientes"],
      sql,
    })
    expect(saved.isError).toBe(false)
    const savedId = (saved.data as { id: string }).id
    const listed = await call(editorToken, "list_saved_queries", {
      q: "MCP",
    })
    expect((listed.data as { id: string }[]).map((q) => q.id)).toContain(
      savedId
    )
    // Viewers cannot use the library.
    expect(
      (await call(readerToken, "save_query", { connectionId, name: "x", sql }))
        .isError
    ).toBe(true)

    const created = await call(editorToken, "create_app", {
      name: "Clientes passo a passo (MCP)",
    })
    const appId = (created.data as { id: string }).id

    const added = await call(editorToken, "add_query", {
      appId,
      savedQueryId: savedId,
      name: "clientes_uf",
    })
    expect(added.isError).toBe(false)
    expect(
      (
        await call(editorToken, "add_query", {
          appId,
          savedQueryId: savedId,
          name: "clientes_uf",
        })
      ).isError
    ).toBe(true)

    const page = await call(editorToken, "add_page", { appId, name: "Detalhe" })
    const pageId = (page.data as { pageId: string }).pageId

    const filter = await call(editorToken, "add_widget", {
      appId,
      pageId,
      type: "text-input",
      props: { label: "UF", param: "uf" },
      grid: { w: 4 },
    })
    expect(filter.isError).toBe(false)
    const table = await call(editorToken, "add_widget", {
      appId,
      pageId,
      type: "table",
      query: "clientes_uf",
      props: { title: "Clientes por UF" },
    })
    expect(table.isError).toBe(false)
    const tableId = (table.data as { widget: { id: string } }).widget.id

    // Invalid props are rejected by the document schema, nothing is saved.
    const invalid = await call(editorToken, "add_widget", {
      appId,
      type: "table",
      props: { pageSize: "muitos" },
    })
    expect(invalid.isError).toBe(true)
    expect(
      (
        await call(editorToken, "add_widget", {
          appId,
          type: "table",
          query: "nao_existe",
        })
      ).isError
    ).toBe(true)

    await call(editorToken, "update_widget", {
      appId,
      widgetId: tableId,
      props: { title: "Clientes por estado" },
      grid: { h: 10 },
    })
    let doc = (await getAppForEdit(editor, appId)).document
    const detail = doc.pages.find((p) => p.id === pageId)!
    expect(doc.queries[0]!.sourceQueryId).toBe(savedId)
    expect(detail.widgets.map((w) => w.type)).toEqual(["text-input", "table"])
    const tableWidget = detail.widgets[1]!
    expect(tableWidget.bindings.data).toBe("{{clientes_uf.data}}")
    expect((tableWidget.props as { title: string }).title).toBe(
      "Clientes por estado"
    )
    expect(tableWidget.grid.h).toBe(10)
    expect(tableWidget.grid.y).toBeGreaterThanOrEqual(detail.widgets[0]!.grid.h)

    await call(editorToken, "remove_widget", { appId, widgetId: tableId })
    doc = (await getAppForEdit(editor, appId)).document
    expect(doc.pages.find((p) => p.id === pageId)!.widgets).toHaveLength(1)

    // Someone without edit access to the screen cannot change it.
    expect(
      (await call(readerToken, "add_page", { appId, name: "x" })).isError
    ).toBe(true)
  })
})
