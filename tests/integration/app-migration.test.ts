import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { CURRENT_SCHEMA_VERSION } from "@/lib/app-schema"
import { defaultProps } from "@/lib/widgets/registry"
import { db } from "@/server/db/client"
import { apps, appVersions } from "@/server/db/schema"
import { closeAllAdapters } from "@/server/datasources/registry"
import { runAppQuery } from "@/server/services/app-run"
import {
  getAppForEdit,
  getRunnableDocument,
  saveDraft,
  setShares,
} from "@/server/services/apps"
import { createConnection, setAccess } from "@/server/services/connections"

import { demoConnectionInput, makeUser } from "../support/fixtures"

type User = Awaited<ReturnType<typeof makeUser>>
let owner: User, viewer: User
let appId: string

/** Screen document as stored by schemaVersion 1 (no `paramBindings`). */
function v1Document(id: string, connectionId: string, sql: string) {
  return {
    schemaVersion: 1,
    app: { id, name: "Tela antiga", description: "", tags: [] },
    queries: [
      {
        id: "q1",
        name: "clientes",
        connectionId,
        sql,
        params: [
          {
            name: "uf",
            type: "text",
            required: false,
            // v1 stored bindings here; v2 moves them to paramBindings.
            default: "{{tabela1.selectedRow.uf}}",
          },
        ],
        runMode: "auto",
        sourceQueryId: null,
        cacheTtlSeconds: 0,
      },
    ],
    pages: [
      {
        id: "p1",
        name: "Página 1",
        layout: { cols: 12, rowHeight: 40 },
        widgets: [
          {
            id: "tabela1",
            type: "table",
            grid: { x: 0, y: 0, w: 12, h: 6 },
            props: defaultProps("table"),
            bindings: { data: "{{clientes.data}}" },
          },
        ],
      },
    ],
  }
}

beforeAll(async () => {
  const admin = await makeUser("admin")
  owner = await makeUser("editor")
  viewer = await makeUser("viewer")
  const connectionId = (
    await createConnection(admin, {
      ...demoConnectionInput,
      name: `Migração ${Date.now()}`,
    })
  ).id
  await setAccess(admin, connectionId, [owner.id])

  const [app] = await db
    .insert(apps)
    .values({
      name: "Tela antiga",
      ownerId: owner.id,
      draft: v1Document(
        "x",
        connectionId,
        "select uf from loja.clientes where uf = :uf limit 1"
      ),
    })
    .returning()
  appId = app!.id
  const [version] = await db
    .insert(appVersions)
    .values({
      appId,
      version: 1,
      // The published snapshot differs from the draft, to tell them apart.
      document: v1Document(
        appId,
        connectionId,
        "select uf, 'publicada' as origem from loja.clientes where uf = :uf limit 1"
      ),
      createdBy: owner.id,
    })
    .returning()
  await db
    .update(apps)
    .set({ publishedVersionId: version!.id, publishedAt: new Date() })
    .where(eq(apps.id, appId))
  await setShares(owner, appId, {
    shares: [{ userId: viewer.id, permission: "view" }],
  })
})

afterAll(async () => {
  await closeAllAdapters()
})

describe("migração do documento ao carregar do banco", () => {
  it("rascunho v1 chega ao editor na versão atual", async () => {
    const { document } = await getAppForEdit(owner, appId)
    expect(document.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(document.queries[0]!.paramBindings).toEqual({
      uf: "{{tabela1.selectedRow.uf}}",
    })
    expect(document.queries[0]!.params[0]!.default).toBeNull()

    const draft = await getRunnableDocument(owner, appId, "draft")
    expect(draft.document.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
  })

  it("versão publicada v1 é migrada para quem só lê e executa", async () => {
    const { document } = await getRunnableDocument(viewer, appId, "published")
    expect(document.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(document.queries[0]!.sql).toContain("publicada")
    expect(document.queries[0]!.paramBindings).toEqual({
      uf: "{{tabela1.selectedRow.uf}}",
    })
    const result = await runAppQuery(viewer, appId, {
      queryId: "q1",
      values: { uf: "CE" },
    })
    expect(result.rows[0]).toEqual(["CE", "publicada"])
  })

  it("o banco guarda o original até a próxima gravação", async () => {
    const [stored] = await db.select().from(apps).where(eq(apps.id, appId))
    expect((stored!.draft as { schemaVersion: number }).schemaVersion).toBe(1)
    const { document, updatedAt } = await getAppForEdit(owner, appId)
    await saveDraft(owner, appId, document, updatedAt)
    const [saved] = await db.select().from(apps).where(eq(apps.id, appId))
    expect((saved!.draft as { schemaVersion: number }).schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    )
  })
})
