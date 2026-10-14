import mysql from "mysql2/promise"
import { afterAll, describe, expect, it } from "vitest"

import { compileSql } from "@/lib/sql-params"
import { MysqlAdapter } from "@/server/datasources/mysql"
import type { ConnectionConfig } from "@/server/datasources/types"

/** MySQL/MariaDB demo created by scripts/dev-setup.sh (CI: mysql service). */
const host = process.env.MYSQL_TEST_HOST ?? "127.0.0.1"
const port = Number(process.env.MYSQL_TEST_PORT ?? 3306)
const config = (username: string, password: string): ConnectionConfig => ({
  key: `mysql-${username}-${Math.random()}`,
  dialect: "mysql",
  host,
  port,
  database: "sqlboard_demo",
  username,
  password,
  ssl: "disable",
  statementTimeoutMs: 30_000,
})

async function reachable() {
  try {
    const c = await mysql.createConnection({
      host,
      port,
      user: "sqlboard_ro",
      password: "demo_ro_local",
      database: "sqlboard_demo",
      connectTimeout: 2000,
    })
    await c.end()
    return true
  } catch {
    return false
  }
}

const available = await reachable()
if (!available && process.env.REQUIRE_DB_TESTS === "1") {
  throw new Error("MySQL de teste indisponível (REQUIRE_DB_TESTS=1).")
}

describe.skipIf(!available)("execução segura no MySQL/MariaDB", () => {
  const ro = new MysqlAdapter(config("sqlboard_ro", "demo_ro_local"))
  const owner = new MysqlAdapter(
    config("sqlboard_owner", process.env.META_DB_PASSWORD ?? "sqlboard")
  )
  afterAll(async () => {
    await ro.close()
    await owner.close()
  })
  const run = (adapter: MysqlAdapter, sql: string, values = {}, opts = {}) =>
    adapter.execute(compileSql(sql, values, { dialect: "mysql" }), {
      maxRows: 100,
      timeoutMs: 10_000,
      ...opts,
    })

  it("usa prepared statements com ? e devolve tipos", async () => {
    const result = await run(
      ro,
      "select id, nome, uf, data_cadastro from clientes where uf = :uf and id < :max order by id",
      { uf: "CE", max: "20" }
    )
    expect(
      compileSql("select :a, :a", { a: "1" }, { dialect: "mysql" }).sql
    ).toBe("select ?, ?")
    expect(result.rows.every((row) => row[2] === "CE")).toBe(true)
    expect(result.columns.map((c) => c.kind)).toEqual([
      "integer",
      "text",
      "text",
      "date",
    ])
    expect(result.rows[0]![3]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("rejeita dois comandos e escrita (mesmo com usuário dono)", async () => {
    await expect(run(owner, "select 1; delete from pedidos")).rejects.toThrow()
    await expect(
      run(owner, "delete from pedidos where id = 1")
    ).rejects.toThrow(/somente leitura/)
    const still = await run(ro, "select count(*) as n from pedidos")
    expect(Number(still.rows[0]![0])).toBe(500)
  })

  it("preserva decimal e bigint e trunca com N+1", async () => {
    const result = await run(
      ro,
      "select total, codigo_grande from pedidos order by id",
      {},
      { maxRows: 5 }
    )
    expect(result.truncated).toBe(true)
    expect(result.rowCount).toBe(5)
    expect(result.rows[0]).toEqual(["51.99", "9007199254740994"])
    expect(result.columns.map((c) => c.kind)).toEqual(["decimal", "integer"])
  })

  it("interrompe por timeout e por cancelamento", async () => {
    await expect(
      run(ro, "select sleep(5)", {}, { timeoutMs: 500 })
    ).rejects.toMatchObject({
      code: expect.stringMatching(/timeout|cancelled/),
    })
    const controller = new AbortController()
    const started = Date.now()
    const promise = run(
      ro,
      "select sleep(10)",
      {},
      { signal: controller.signal }
    )
    setTimeout(() => controller.abort(), 300)
    await expect(promise).rejects.toMatchObject({ code: "cancelled" })
    expect(Date.now() - started).toBeLessThan(5000)
  })

  it("introspecta tabelas, chaves e índices", async () => {
    const schema = await ro.introspect()
    expect(schema.serverVersion).toMatch(/MariaDB|MySQL/)
    const pedidos = schema.tables.find((t) => t.name === "pedidos")!
    expect(pedidos.comment).toBe("Pedidos")
    expect(pedidos.columns.find((c) => c.name === "id")?.primaryKey).toBe(true)
    expect(pedidos.foreignKeys[0]?.references.table).toBe("clientes")
    expect(pedidos.indexes.map((i) => i.name)).toContain("pedidos_data_idx")
  })
})
