import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { db } from "@/server/db/client"
import { connections, queryExecutions } from "@/server/db/schema"
import { closeAllAdapters } from "@/server/datasources/registry"
import { executeQuery } from "@/server/execution/execute"
import { HttpError } from "@/server/http"
import {
  createConnection,
  getSchema,
  getUsableConnection,
  listConnections,
  setAccess,
  testConnection,
  updateConnection,
} from "@/server/services/connections"
import {
  createSavedQuery,
  getSavedQuery,
  listSavedQueries,
  listVersions,
  restoreVersion,
  updateSavedQuery,
} from "@/server/services/queries"

import { demoConnectionInput, makeUser } from "../support/fixtures"

let admin: Awaited<ReturnType<typeof makeUser>>
let editor: Awaited<ReturnType<typeof makeUser>>
let outsider: Awaited<ReturnType<typeof makeUser>>
let viewer: Awaited<ReturnType<typeof makeUser>>
let connectionId: string

const status = (promise: Promise<unknown>) =>
  promise.then(
    () => 200,
    (error) => (error instanceof HttpError ? error.status : 500)
  )

beforeAll(async () => {
  admin = await makeUser("admin")
  editor = await makeUser("editor")
  outsider = await makeUser("editor")
  viewer = await makeUser("viewer")
  const created = await createConnection(admin, demoConnectionInput)
  connectionId = created.id
  await setAccess(admin, connectionId, [editor.id])
})

afterAll(async () => {
  await closeAllAdapters()
})

describe("permissões de conexão no servidor", () => {
  it("só admin cria, edita e testa conexões", async () => {
    expect(await status(createConnection(editor, demoConnectionInput))).toBe(
      403
    )
    expect(
      await status(updateConnection(editor, connectionId, demoConnectionInput))
    ).toBe(403)
    expect(await status(testConnection(viewer, demoConnectionInput))).toBe(403)
    expect(await status(setAccess(editor, connectionId, [editor.id]))).toBe(403)
  })

  it("editor usa só conexões liberadas; outros recebem 404", async () => {
    expect((await listConnections(editor)).map((c) => c.id)).toContain(
      connectionId
    )
    expect(await listConnections(outsider)).toEqual([])
    expect(await listConnections(viewer)).toEqual([])
    expect(await status(getUsableConnection(outsider, connectionId))).toBe(404)
    expect(await status(getSchema(outsider, connectionId))).toBe(404)
  })

  it("nunca expõe a senha e guarda cifrada", async () => {
    const [view] = await listConnections(admin)
    expect(view).not.toHaveProperty("passwordEnc")
    expect(JSON.stringify(view)).not.toContain(demoConnectionInput.password)
    const [row] = await db
      .select()
      .from(connections)
      .where(eq(connections.id, connectionId))
    expect(row!.passwordEnc).toMatch(/^v1:1:/)
    expect(row!.passwordEnc).not.toContain(demoConnectionInput.password)
  })

  it("edição sem senha mantém a senha guardada", async () => {
    await updateConnection(admin, connectionId, {
      ...demoConnectionInput,
      password: undefined,
      description: "x",
    })
    await expect(
      testConnection(
        admin,
        { ...demoConnectionInput, password: undefined },
        connectionId
      )
    ).resolves.toEqual({ ok: true })
  })

  it("introspecção fica em cache por conexão", async () => {
    const first = await getSchema(editor, connectionId)
    const cached = await getSchema(editor, connectionId)
    expect(cached.introspectedAt).toBe(first.introspectedAt)
    const refreshed = await getSchema(editor, connectionId, true)
    expect(refreshed.tables.length).toBe(first.tables.length)
  })
})

describe("biblioteca de queries e auditoria", () => {
  it("cria, versiona, restaura e respeita dono", async () => {
    const created = await createSavedQuery(editor, {
      name: "Clientes por UF",
      description: "Teste",
      tags: ["Clientes", "clientes"],
      connectionId,
      sql: "select count(*) from loja.clientes where uf = :uf",
      params: [{ name: "uf", type: "text", required: true }],
    })
    expect(created.tags).toEqual(["clientes"])
    expect(created.version).toBe(1)
    const updated = await updateSavedQuery(editor, created.id, {
      ...created,
      sql: "select count(*) as total from loja.clientes where uf = :uf",
    })
    expect(updated.version).toBe(2)
    const restored = await restoreVersion(editor, created.id, 1)
    expect(restored.version).toBe(3)
    expect(restored.sql).toBe(created.sql)
    expect(
      (await listVersions(editor, created.id)).map((v) => v.version)
    ).toEqual([3, 2, 1])

    expect(await status(getSavedQuery(outsider, created.id))).toBe(404)
    expect(await listSavedQueries(outsider)).toEqual([])
    expect(await status(listSavedQueries(viewer))).toBe(403)
    expect(
      (await listSavedQueries(editor, { q: "UF" })).map((q) => q.id)
    ).toEqual([created.id])
    expect((await listSavedQueries(editor, { tag: "clientes" })).length).toBe(1)
    const otherEditor = await makeUser("editor")
    await setAccess(admin, connectionId, [editor.id, otherEditor.id])
    const seen = await getSavedQuery(otherEditor, created.id)
    expect(seen.canEdit).toBe(false)
    expect(
      await status(updateSavedQuery(otherEditor, created.id, created))
    ).toBe(403)
  })

  it("registra a execução na auditoria, com limite da conexão", async () => {
    const row = await getUsableConnection(editor, connectionId)
    const result = await executeQuery({
      user: editor,
      connection: { ...row, maxRowLimit: 3 },
      sql: "select g from generate_series(1, 10) g where g > :min",
      params: [{ name: "min", type: "integer", required: true }],
      values: { min: "0" },
      source: "editor",
      maxRows: 1000,
    })
    expect(result.rowCount).toBe(3)
    expect(result.truncated).toBe(true)
    const [audit] = await db
      .select()
      .from(queryExecutions)
      .where(eq(queryExecutions.userId, editor.id))
    expect(audit).toMatchObject({
      status: "ok",
      rowCount: 3,
      truncated: true,
      params: { min: 0 },
    })
    expect(audit!.sqlHash).toHaveLength(32)

    await expect(
      executeQuery({
        user: editor,
        connection: row,
        sql: "delete from loja.clientes",
        source: "editor",
      })
    ).rejects.toThrow(/leitura/)
  })
})
