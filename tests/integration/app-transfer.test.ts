import { beforeAll, describe, expect, it } from "vitest"

import { newDocument, type AppDocument } from "@/lib/app-schema"
import { stableStringify } from "@/lib/app-schema/file"
import { defaultProps } from "@/lib/widgets/registry"
import { HttpError } from "@/server/http"
import {
  createApp,
  getAppForEdit,
  publishApp,
  saveDraft,
  setShares,
} from "@/server/services/apps"
import { exportAppFile, importAppFile } from "@/server/services/app-transfer"
import { createConnection, setAccess } from "@/server/services/connections"

import { demoConnectionInput, makeUser } from "../support/fixtures"

type User = Awaited<ReturnType<typeof makeUser>>
let admin: User, author: User, colleague: User, viewer: User
let sourceConnection: string
let otherConnection: string
let appId: string

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error) => error as HttpError
  )

function screen(id: string): AppDocument {
  const doc = newDocument({ id, name: "Vendas por UF", tags: ["vendas"] })
  doc.queries.push({
    id: "q1",
    name: "ufs",
    connectionId: sourceConnection,
    sql: "select uf, count(*) as total from loja.clientes group by uf",
    params: [],
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
    bindings: { data: "{{ufs.data}}" },
  })
  return doc
}

beforeAll(async () => {
  admin = await makeUser("admin")
  author = await makeUser("editor")
  colleague = await makeUser("editor")
  viewer = await makeUser("viewer")
  sourceConnection = (
    await createConnection(admin, {
      ...demoConnectionInput,
      name: `Origem ${Date.now()}`,
    })
  ).id
  otherConnection = (
    await createConnection(admin, {
      ...demoConnectionInput,
      name: `Destino ${Date.now()}`,
    })
  ).id
  await setAccess(admin, sourceConnection, [author.id])
  await setAccess(admin, otherConnection, [colleague.id])
  appId = (await createApp(author, { name: "Vendas por UF" })).id
  await saveDraft(author, appId, screen(appId))
  await publishApp(author, appId)
  await setShares(author, appId, {
    shares: [{ userId: viewer.id, permission: "view" }],
  })
})

describe("exportar e importar telas em JSON", () => {
  it("exporta com chaves ordenadas; leitor não exporta (o arquivo tem SQL)", async () => {
    const file = await exportAppFile(author, appId, "published")
    expect(file.format).toBe("sqlboard-app")
    expect(file.document.queries[0]!.sql).toContain("loja.clientes")
    const text = stableStringify(file)
    expect(text).toBe(stableStringify(JSON.parse(text)))
    expect(text.indexOf('"document"')).toBeLessThan(
      text.indexOf('"exportedAt"')
    )
    expect(text.endsWith("}\n")).toBe(true)
    expect(
      (await failure(exportAppFile(viewer, appId, "published")))?.status
    ).toBe(403)
    expect(
      (await failure(exportAppFile(colleague, appId, "draft")))?.status
    ).toBe(404)
  })

  it("pede mapeamento de conexões e importa como tela nova", async () => {
    const file = await exportAppFile(author, appId, "draft")
    const refused = await failure(importAppFile(colleague, { file }))
    expect(refused?.status).toBe(400)
    expect(refused?.details).toEqual({
      missingConnections: [
        { connectionId: sourceConnection, queries: ["ufs"] },
      ],
    })
    // Mapping to a connection the importer cannot use is refused too.
    expect(
      (
        await failure(
          importAppFile(colleague, {
            file,
            connectionMap: { [sourceConnection]: sourceConnection },
          })
        )
      )?.status
    ).toBe(400)
    const imported = await importAppFile(colleague, {
      file,
      connectionMap: { [sourceConnection]: otherConnection },
    })
    expect(imported.created).toBe(true)
    expect(imported.id).not.toBe(appId)
    const copy = await getAppForEdit(colleague, imported.id)
    expect(copy.document.app.id).toBe(imported.id)
    expect(copy.document.queries[0]!.connectionId).toBe(otherConnection)
    expect(copy.ownerId).toBe(colleague.id)
    expect(copy.publishedVersion).toBeNull()
  })

  it("migra documentos antigos e recusa versões futuras ou inválidas", async () => {
    const v1 = structuredClone(
      screen("00000000-0000-4000-8000-000000000000")
    ) as Record<string, unknown>
    v1.schemaVersion = 1
    for (const q of v1.queries as Record<string, unknown>[])
      delete q.paramBindings
    const imported = await importAppFile(author, { file: v1 })
    const doc = (await getAppForEdit(author, imported.id)).document
    expect(doc.schemaVersion).toBe(2)
    expect(doc.queries[0]!.paramBindings).toEqual({})
    // Same owner already has "Vendas por UF": the copy gets a suffix.
    expect(doc.app.name).toBe("Vendas por UF (importada)")

    expect(
      (
        await failure(
          importAppFile(author, { file: { ...v1, schemaVersion: 99 } })
        )
      )?.status
    ).toBe(400)
    await expect(importAppFile(author, { file: { foo: 1 } })).rejects.toThrow()
    expect((await failure(importAppFile(viewer, { file: v1 })))?.status).toBe(
      403
    )
  })

  it("substitui o rascunho de uma tela existente (fluxo git)", async () => {
    const file = await exportAppFile(author, appId, "draft")
    file.document.app.name = "Vendas por UF (revisada)"
    const result = await importAppFile(author, { file, targetAppId: appId })
    expect(result).toEqual({ id: appId, created: false })
    expect((await getAppForEdit(author, appId)).document.app.name).toBe(
      "Vendas por UF (revisada)"
    )
    expect(
      (
        await failure(
          importAppFile(colleague, {
            file,
            connectionMap: { [sourceConnection]: otherConnection },
            targetAppId: appId,
          })
        )
      )?.status
    ).toBe(404)
  })
})
