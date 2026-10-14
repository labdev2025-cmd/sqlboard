import { afterAll, beforeAll, describe, expect, it } from "vitest"

import * as appExport from "@/app/api/apps/[id]/export/route"
import * as queryExport from "@/app/api/export/route"
import { newDocument } from "@/lib/app-schema"
import { defaultProps } from "@/lib/widgets/registry"
import { closeAllAdapters } from "@/server/datasources/registry"
import { createToken } from "@/server/services/api-tokens"
import {
  createApp,
  publishApp,
  saveDraft,
  setShares,
} from "@/server/services/apps"
import { createConnection, setAccess } from "@/server/services/connections"

import { demoConnectionInput, makeUser } from "../support/fixtures"

type Handler = (
  request: Request,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>

type User = Awaited<ReturnType<typeof makeUser>>

const MAX_ROWS = 3
const SQL = "select n from generate_series(1, 10) as n"

let owner: User, outsider: User, viewer: User
let connectionId: string
let appId: string
const tokens = new Map<User, string>()

function post(handler: unknown, user: User, body: unknown, id = "") {
  return (handler as Handler)(
    new Request("http://localhost/api/export", {
      method: "POST",
      headers: {
        authorization: `Bearer ${tokens.get(user)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  )
}

/** CSV data lines (without the header and the trailing line break). */
async function csvRows(response: Response) {
  const lines = (await response.text()).split("\r\n").filter(Boolean)
  return lines.slice(1)
}

beforeAll(async () => {
  const admin = await makeUser("admin")
  owner = await makeUser("editor")
  outsider = await makeUser("editor")
  viewer = await makeUser("viewer")
  for (const user of [owner, outsider, viewer]) {
    tokens.set(user, (await createToken(user, { name: "Exportação" })).token)
  }
  connectionId = (
    await createConnection(admin, {
      ...demoConnectionInput,
      name: `Exportação ${Date.now()}`,
      defaultRowLimit: 2,
      maxRowLimit: MAX_ROWS,
    })
  ).id
  await setAccess(admin, connectionId, [owner.id])

  appId = (await createApp(owner, { name: "Exportação" })).id
  const doc = newDocument({ id: appId, name: "Exportação" })
  doc.queries.push({
    id: "q1",
    name: "numeros",
    connectionId,
    sql: SQL,
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
    bindings: { data: "{{numeros.data}}" },
  })
  await saveDraft(owner, appId, doc)
  await publishApp(owner, appId)
  await setShares(owner, appId, {
    shares: [{ userId: viewer.id, permission: "view" }],
  })
})

afterAll(async () => {
  await closeAllAdapters()
})

describe("exportação do editor (/api/export)", () => {
  it("limita as linhas ao máximo da conexão, mesmo pedindo mais", async () => {
    const response = await post(queryExport.POST, owner, {
      connectionId,
      sql: SQL,
      maxRows: 1000,
      format: "csv",
    })
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/csv")
    expect(await csvRows(response)).toEqual(["1", "2", "3"])
  })

  it("recusa quem não tem acesso à conexão e o leitor", async () => {
    const body = { connectionId, sql: SQL, format: "csv" }
    expect((await post(queryExport.POST, outsider, body)).status).toBe(404)
    expect((await post(queryExport.POST, viewer, body)).status).toBe(403)
  })
})

describe("exportação da tela (/api/apps/[id]/export)", () => {
  it("leitor com compartilhamento exporta a versão publicada até o máximo", async () => {
    const response = await post(
      appExport.POST,
      viewer,
      { queryId: "q1", format: "csv" },
      appId
    )
    expect(response.status).toBe(200)
    expect(await csvRows(response)).toHaveLength(MAX_ROWS)
  })

  it("recusa rascunho para o leitor e a tela para quem não tem acesso", async () => {
    expect(
      (
        await post(
          appExport.POST,
          viewer,
          { queryId: "q1", mode: "draft" },
          appId
        )
      ).status
    ).toBe(403)
    expect(
      (await post(appExport.POST, outsider, { queryId: "q1" }, appId)).status
    ).toBe(404)
  })
})
