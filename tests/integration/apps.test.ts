import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { newDocument, type AppDocument } from "@/lib/app-schema"
import { defaultProps } from "@/lib/widgets/registry"
import { closeAllAdapters } from "@/server/datasources/registry"
import { HttpError } from "@/server/http"
import { runAppQuery } from "@/server/services/app-run"
import {
  createApp,
  deleteApp,
  duplicateApp,
  getAppForEdit,
  getRunnableDocument,
  listAppVersions,
  listApps,
  publishApp,
  restoreAppVersion,
  saveDraft,
  setShares,
} from "@/server/services/apps"
import { createConnection, setAccess } from "@/server/services/connections"

import { demoConnectionInput, makeUser } from "../support/fixtures"

type User = Awaited<ReturnType<typeof makeUser>>
let admin: User, owner: User, editor2: User, viewer: User, outsider: User
let connectionId: string
let otherConnectionId: string
let appId: string

const status = (promise: Promise<unknown>) =>
  promise.then(
    () => 200,
    (error) =>
      error instanceof HttpError ? error.status : (console.error(error), 500)
  )

function documentWithQuery(id: string, name = "Vendas"): AppDocument {
  const doc = newDocument({ id, name })
  doc.queries.push({
    id: "q1",
    name: "clientes",
    connectionId,
    sql: "select uf, count(*) as total from loja.clientes where uf = :uf group by uf",
    params: [{ name: "uf", type: "text", required: true }],
    runMode: "auto",
    sourceQueryId: null,
    cacheTtlSeconds: 0,
    paramBindings: {},
  })
  doc.pages[0]!.widgets.push({
    id: "tabela1",
    type: "table",
    grid: { x: 0, y: 0, w: 12, h: 6 },
    props: defaultProps("table"),
    bindings: { data: "{{clientes.data}}" },
  })
  return doc
}

beforeAll(async () => {
  admin = await makeUser("admin")
  owner = await makeUser("editor")
  editor2 = await makeUser("editor")
  viewer = await makeUser("viewer")
  outsider = await makeUser("editor")
  connectionId = (
    await createConnection(admin, {
      ...demoConnectionInput,
      name: `Apps ${Date.now()}`,
    })
  ).id
  otherConnectionId = (
    await createConnection(admin, {
      ...demoConnectionInput,
      name: `Outra ${Date.now()}`,
    })
  ).id
  await setAccess(admin, connectionId, [owner.id])
  appId = (
    await createApp(owner, {
      name: "Clientes",
      description: "Teste",
      tags: ["Clientes"],
    })
  ).id
})

afterAll(async () => {
  await closeAllAdapters()
})

describe("telas: permissões no servidor", () => {
  it("leitor não cria; dono edita; outros não veem rascunho", async () => {
    expect(await status(createApp(viewer, { name: "x" }))).toBe(403)
    expect((await getAppForEdit(owner, appId)).document.app.name).toBe(
      "Clientes"
    )
    expect(await status(getAppForEdit(outsider, appId))).toBe(404)
    expect(await status(getAppForEdit(viewer, appId))).toBe(404)
    expect((await listApps(outsider)).map((a) => a.id)).not.toContain(appId)
  })

  it("salva rascunho válido e recusa query em conexão sem acesso", async () => {
    const app = await getAppForEdit(owner, appId)
    const saved = await saveDraft(
      owner,
      appId,
      documentWithQuery(appId, "Clientes"),
      app.updatedAt
    )
    expect(saved.updatedAt).toBeTruthy()
    // stale editor → conflict
    expect(
      await status(
        saveDraft(owner, appId, documentWithQuery(appId), app.updatedAt)
      )
    ).toBe(409)
    const evil = documentWithQuery(appId)
    evil.queries[0]!.connectionId = otherConnectionId
    expect(await status(saveDraft(owner, appId, evil))).toBe(403)
    const invalid = { ...documentWithQuery(appId), pages: [] }
    expect(await status(saveDraft(owner, appId, invalid))).toBe(400)
  })

  it("executa a query do rascunho com o SQL guardado, nunca o do navegador", async () => {
    const result = await runAppQuery(owner, appId, {
      queryId: "q1",
      values: { uf: "CE" },
      mode: "draft",
    })
    expect(result.columns.map((c) => c.name)).toEqual(["uf", "total"])
    expect(
      await status(
        runAppQuery(owner, appId, { queryId: "nao-existe", mode: "draft" })
      )
    ).toBe(404)
  })

  it("publica, compartilha e o leitor só usa a versão publicada", async () => {
    expect(
      await status(
        runAppQuery(viewer, appId, { queryId: "q1", values: { uf: "CE" } })
      )
    ).toBe(404)
    const published = await publishApp(owner, appId, "primeira")
    expect(published.version).toBe(1)
    await setShares(owner, appId, {
      shares: [{ userId: viewer.id, permission: "edit" }],
    })
    // A viewer never gets edit rights, even if shared with "edit".
    expect(await status(getAppForEdit(viewer, appId))).toBe(403)
    expect((await listApps(viewer)).map((a) => a.id)).toEqual([appId])
    const doc = await getRunnableDocument(viewer, appId, "published")
    expect(doc.document.queries[0]!.name).toBe("clientes")
    const result = await runAppQuery(viewer, appId, {
      queryId: "q1",
      values: { uf: "SP" },
    })
    expect(result.rows[0]![0]).toBe("SP")
    expect(
      await status(runAppQuery(viewer, appId, { queryId: "q1", mode: "draft" }))
    ).toBe(403)

    // Draft changes do not leak into the published version.
    const changed = documentWithQuery(appId, "Clientes")
    changed.queries[0]!.sql =
      "select 'rascunho' as uf, 0 as total where :uf is not null"
    await saveDraft(owner, appId, changed)
    const again = await runAppQuery(viewer, appId, {
      queryId: "q1",
      values: { uf: "SP" },
    })
    expect(again.rows[0]![0]).toBe("SP")
  })

  it("compartilhamento de edição vale para editores; histórico e restauração", async () => {
    await setShares(owner, appId, {
      shares: [
        { userId: viewer.id, permission: "view" },
        { userId: editor2.id, permission: "edit" },
      ],
    })
    expect((await getAppForEdit(editor2, appId)).permission).toBe("edit")
    // editor2 has no access to the connection: may edit layout but not change queries.
    const doc = (await getAppForEdit(editor2, appId)).document
    doc.pages[0]!.widgets[0]!.grid.h = 9
    await saveDraft(editor2, appId, doc)
    doc.queries[0]!.sql = "select 1 as uf, 2 as total where :uf is not null"
    expect(await status(saveDraft(editor2, appId, doc))).toBe(403)
    await publishApp(owner, appId)
    expect((await listAppVersions(owner, appId)).map((v) => v.version)).toEqual(
      [2, 1]
    )
    await restoreAppVersion(owner, appId, 1)
    expect(
      (await getAppForEdit(owner, appId)).document.queries[0]!.sql
    ).toContain("from loja.clientes")
  })

  it("duplica e só o dono (ou admin) exclui", async () => {
    const copy = await duplicateApp(editor2, appId)
    expect((await getAppForEdit(editor2, copy.id)).document.app.name).toBe(
      "Clientes (cópia)"
    )
    expect(await status(deleteApp(editor2, appId))).toBe(403)
    expect(await status(deleteApp(outsider, appId))).toBe(404)
    await deleteApp(admin, copy.id)
    expect(await status(getAppForEdit(editor2, copy.id))).toBe(404)
  })
})
