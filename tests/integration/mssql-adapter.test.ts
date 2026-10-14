import { afterAll, describe, expect, it } from "vitest"

import { compileSql } from "@/lib/sql-params"
import { MssqlAdapter } from "@/server/datasources/mssql"
import type { ConnectionConfig } from "@/server/datasources/types"

/** Runs when MSSQL_TEST_HOST is set (CI service container; see ci.yml). */
const host = process.env.MSSQL_TEST_HOST
const config = (username: string, password: string): ConnectionConfig => ({
  key: `mssql-${username}-${Math.random()}`,
  dialect: "mssql",
  host: host ?? "",
  port: Number(process.env.MSSQL_TEST_PORT ?? 1433),
  database: "sqlboard_demo",
  username,
  password,
  ssl: "require",
  statementTimeoutMs: 30_000,
})

describe.skipIf(!host)("execução segura no SQL Server", () => {
  const ro = new MssqlAdapter(
    config("sqlboard_ro", process.env.MSSQL_RO_PASSWORD ?? "Demo_ro_local1")
  )
  const owner = new MssqlAdapter(
    config("sa", process.env.MSSQL_ADMIN_PASSWORD ?? "")
  )
  afterAll(async () => {
    await ro.close()
    await owner.close()
  })
  const run = (adapter: MssqlAdapter, sql: string, values = {}, opts = {}) =>
    adapter.execute(compileSql(sql, values, { dialect: "mssql" }), {
      maxRows: 100,
      timeoutMs: 10_000,
      ...opts,
    })

  it("usa @pN, devolve tipos e preserva precisão", async () => {
    const result = await run(
      ro,
      "select top 3 id, uf, total, codigo_grande, data_pedido from dbo.pedidos p join dbo.clientes c on c.id = p.cliente_id where uf = :uf and :uf = :uf order by p.id",
      { uf: "SP" }
    )
    expect(
      compileSql("select :a, :a", { a: "1" }, { dialect: "mssql" }).sql
    ).toBe("select @p1, @p1")
    expect(result.rows.every((row) => row[1] === "SP")).toBe(true)
    expect(result.columns.map((c) => c.kind)).toEqual([
      "integer",
      "text",
      "decimal",
      "integer",
      "datetime",
    ])
    expect(typeof result.rows[0]![3]).toBe("string")
  })

  it("desfaz qualquer escrita (transação sempre revertida)", async () => {
    await expect(
      run(owner, "delete from dbo.pedidos where id = 1; select 1 as x")
    ).resolves.toBeTruthy()
    const still = await run(ro, "select count(*) as n from dbo.pedidos")
    expect(still.rows[0]![0]).toBe(200)
    await expect(run(ro, "delete from dbo.pedidos")).rejects.toThrow()
  })

  it("trunca com N+1, interrompe por timeout e por cancelamento", async () => {
    const truncated = await run(
      ro,
      "select id from dbo.pedidos order by id",
      {},
      { maxRows: 10 }
    )
    expect(truncated.truncated).toBe(true)
    await expect(
      run(ro, "waitfor delay '00:00:05'; select 1 as x", {}, { timeoutMs: 500 })
    ).rejects.toMatchObject({ code: "timeout" })
    const controller = new AbortController()
    const promise = run(
      ro,
      "waitfor delay '00:00:10'; select 1 as x",
      {},
      { signal: controller.signal }
    )
    setTimeout(() => controller.abort(), 300)
    await expect(promise).rejects.toMatchObject({ code: "cancelled" })
  })

  it("introspecta", async () => {
    const schema = await ro.introspect()
    expect(schema.serverVersion).toMatch(/^SQL Server/)
    const pedidos = schema.tables.find((t) => t.name === "pedidos")!
    expect(pedidos.columns.find((c) => c.name === "id")?.primaryKey).toBe(true)
    expect(pedidos.foreignKeys[0]?.references.table).toBe("clientes")
    expect(pedidos.indexes.map((i) => i.name)).toContain("pedidos_data_idx")
  })
})
