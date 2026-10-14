import { execFileSync } from "node:child_process"
import path from "node:path"

import { beforeAll, describe, expect, it } from "vitest"

import { compileSql } from "@/lib/sql-params"
import { resolveSqlitePath, SqliteAdapter } from "@/server/datasources/sqlite"

const dir = path.resolve("data/sqlite-test")

beforeAll(() => {
  process.env.SQLBOARD_SQLITE_DIR = dir
  execFileSync("node", ["scripts/demo-sqlite.mjs", "teste.db"], {
    env: { ...process.env, SQLBOARD_SQLITE_DIR: dir },
  })
})

const adapter = (database = "teste.db") =>
  new SqliteAdapter({
    key: "sqlite",
    dialect: "sqlite",
    host: "",
    port: null,
    database,
    username: "",
    password: null,
    ssl: "disable",
    statementTimeoutMs: 10_000,
  })
const run = (sql: string, values = {}, opts = {}) =>
  adapter().execute(compileSql(sql, values, { dialect: "sqlite" }), {
    maxRows: 100,
    timeoutMs: 10_000,
    ...opts,
  })

describe("execução segura no SQLite", () => {
  it("executa com ? e preserva inteiros grandes", async () => {
    const result = await run(
      "select pedidos.id, uf, codigo_grande, total from pedidos join clientes c on c.id = cliente_id where uf = :uf limit 3",
      { uf: "SP" }
    )
    expect(result.rowCount).toBe(3)
    expect(typeof result.rows[0]![2]).toBe("string")
    expect(result.columns.map((c) => c.kind)).toEqual([
      "integer",
      "text",
      "integer",
      "decimal",
    ])
  })

  it("rejeita dois comandos, escrita e ATTACH", async () => {
    await expect(run("select 1; select 2")).rejects.toThrow(/único comando/)
    await expect(run("delete from pedidos")).rejects.toThrow(
      /somente para leitura|Escrita bloqueada/
    )
    await expect(run("attach database 'x.db' as x")).rejects.toThrow()
    expect((await run("select count(*) from pedidos")).rows[0]![0]).toBe(500)
  })

  it("trunca com N+1, interrompe por timeout e cancela sem travar o servidor", async () => {
    const result = await run(
      "select id from pedidos order by id",
      {},
      { maxRows: 10 }
    )
    expect(result.truncated).toBe(true)
    const slow =
      "with recursive r(n) as (select 1 union all select n + 1 from r) select count(*) from r"
    const started = Date.now()
    let ticks = 0
    const timer = setInterval(() => ticks++, 20)
    await expect(run(slow, {}, { timeoutMs: 400 })).rejects.toMatchObject({
      code: "timeout",
    })
    clearInterval(timer)
    expect(Date.now() - started).toBeLessThan(3000)
    expect(ticks).toBeGreaterThan(5) // the event loop kept running
    const controller = new AbortController()
    const promise = run(slow, {}, { signal: controller.signal })
    setTimeout(() => controller.abort(), 200)
    await expect(promise).rejects.toMatchObject({ code: "cancelled" })
  })

  it("introspecta e restringe o diretório dos arquivos", async () => {
    const schema = await adapter().introspect()
    expect(schema.serverVersion).toMatch(/^SQLite 3/)
    const pedidos = schema.tables.find((t) => t.name === "pedidos")!
    expect(pedidos.foreignKeys[0]?.references.table).toBe("clientes")
    expect(pedidos.indexes.map((i) => i.name)).toContain("pedidos_data_idx")
    expect(
      schema.tables.find((t) => t.name === "pedidos_por_status")?.type
    ).toBe("view")
    expect(() => resolveSqlitePath("../../etc/passwd", dir)).toThrow(
      /precisa ficar dentro/
    )
    expect(() => resolveSqlitePath("/etc/passwd", dir)).toThrow()
    await expect(adapter("nao-existe.db").testConnection()).rejects.toThrow(
      /não encontrado/
    )
  })
})
