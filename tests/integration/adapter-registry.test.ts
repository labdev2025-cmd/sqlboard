import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { compileSql } from "@/lib/sql-params"
import { adapterFor, closeAllAdapters } from "@/server/datasources/registry"
import {
  createConnection,
  deleteConnection,
  getConnectionRow,
  updateConnection,
} from "@/server/services/connections"

import { demoConnectionInput, makeUser } from "../support/fixtures"

type User = Awaited<ReturnType<typeof makeUser>>
let admin: User

beforeAll(async () => {
  admin = await makeUser("admin")
})

afterAll(async () => {
  await closeAllAdapters()
})

const input = (name: string) => ({ ...demoConnectionInput, name })

describe("pool por conexão (registry)", () => {
  it("reaproveita o adapter enquanto a conexão não muda", async () => {
    const { id } = await createConnection(admin, input(`Pool ${Date.now()}`))
    const row = await getConnectionRow(id)
    expect(adapterFor(row)).toBe(adapterFor(row))
    await deleteConnection(admin, id)
  })

  it("editar a conexão fecha o pool antigo e cria outro", async () => {
    const name = `Pool editado ${Date.now()}`
    const { id } = await createConnection(admin, input(name))
    const before = adapterFor(await getConnectionRow(id))
    await before.execute(compileSql("select 1", {}), {
      maxRows: 1,
      timeoutMs: 5000,
    })
    const close = vi.spyOn(before, "close")
    await updateConnection(admin, id, {
      ...input(name),
      statementTimeoutMs: 20_000,
    })
    expect(close).toHaveBeenCalledTimes(1)
    const after = adapterFor(await getConnectionRow(id))
    expect(after).not.toBe(before)
    const result = await after.execute(compileSql("select 2 as n", {}), {
      maxRows: 1,
      timeoutMs: 5000,
    })
    expect(result.rows[0]![0]).toBe(2)
    await deleteConnection(admin, id)
  })

  it("excluir a conexão fecha o pool", async () => {
    const { id } = await createConnection(
      admin,
      input(`Pool excluído ${Date.now()}`)
    )
    const adapter = adapterFor(await getConnectionRow(id))
    const close = vi.spyOn(adapter, "close")
    await deleteConnection(admin, id)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it("linha com versão nova (outro processo editou) substitui e fecha o antigo", async () => {
    const { id } = await createConnection(
      admin,
      input(`Pool versão ${Date.now()}`)
    )
    const row = await getConnectionRow(id)
    const old = adapterFor(row)
    const close = vi.spyOn(old, "close")
    const newer = { ...row, updatedAt: new Date(row.updatedAt.getTime() + 1) }
    expect(adapterFor(newer)).not.toBe(old)
    expect(close).toHaveBeenCalledTimes(1)
    await deleteConnection(admin, id)
  })
})
