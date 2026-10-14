import { afterAll, describe, expect, it } from "vitest"

import { compileSql } from "@/lib/sql-params"
import { PostgresAdapter } from "@/server/datasources/postgres"
import { DataSourceError } from "@/server/datasources/types"

import { demoConfig, ownerConfig } from "../support/demo"

const ro = new PostgresAdapter(demoConfig())
const owner = new PostgresAdapter(ownerConfig())
afterAll(async () => {
  await ro.close()
  await owner.close()
})

const run = (adapter: PostgresAdapter, sql: string, values = {}, opts = {}) =>
  adapter.execute(compileSql(sql, values), {
    maxRows: 100,
    timeoutMs: 10_000,
    ...opts,
  })

describe("execução segura no PostgreSQL", () => {
  it("executa com parâmetros e devolve tipos das colunas", async () => {
    const result = await run(
      ro,
      "select id, nome, preco, ativo, criado_em, criado_em::date as dia from loja.produtos where id = :id",
      { id: "1" }
    )
    expect(result.rowCount).toBe(1)
    expect(result.columns.map((c) => [c.name, c.kind])).toEqual([
      ["id", "integer"],
      ["nome", "text"],
      ["preco", "decimal"],
      ["ativo", "boolean"],
      ["criado_em", "datetime"],
      ["dia", "date"],
    ])
    expect(typeof result.rows[0]![2]).toBe("string")
    expect(result.rows[0]![5]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("rejeita dois comandos na mesma chamada (protocolo estendido)", async () => {
    await expect(run(owner, "select 1; select 2")).rejects.toThrow(
      /único comando/
    )
    await expect(
      run(owner, "select 1; drop table loja.categorias")
    ).rejects.toBeInstanceOf(DataSourceError)
    const still = await run(ro, "select count(*) as n from loja.categorias")
    expect(Number(still.rows[0]![0])).toBeGreaterThan(0)
  })

  it("rejeita escrita mesmo com usuário dono (READ ONLY)", async () => {
    await expect(
      run(owner, "insert into loja.categorias(nome) values ('Invasora')")
    ).rejects.toThrow(/somente leitura/)
    await expect(
      run(
        owner,
        "with x as (delete from loja.categorias returning *) select * from x"
      )
    ).rejects.toThrow(/somente leitura/)
    await expect(run(owner, "create table loja.nova(a int)")).rejects.toThrow(
      /somente leitura/
    )
  })

  it("interrompe por timeout", async () => {
    await expect(
      run(ro, "select pg_sleep(5)", {}, { timeoutMs: 300 })
    ).rejects.toMatchObject({
      code: "timeout",
    })
  })

  it("lê com cursor até N+1 e indica truncamento", async () => {
    const result = await run(
      ro,
      "select g from generate_series(1, 50) g",
      {},
      { maxRows: 10 }
    )
    expect(result.rowCount).toBe(10)
    expect(result.truncated).toBe(true)
    expect(result.limit).toBe(10)
    const exact = await run(
      ro,
      "select g from generate_series(1, 10) g",
      {},
      { maxRows: 10 }
    )
    expect(exact.truncated).toBe(false)
  })

  it("cancela pelo AbortSignal (pg_cancel_backend)", async () => {
    const controller = new AbortController()
    const started = Date.now()
    const promise = run(
      ro,
      "select pg_sleep(10)",
      {},
      { signal: controller.signal }
    )
    setTimeout(() => controller.abort(), 400)
    await expect(promise).rejects.toMatchObject({ code: "cancelled" })
    expect(Date.now() - started).toBeLessThan(5000)
    // The pool remains usable afterwards.
    expect((await run(ro, "select 1 as ok")).rows).toEqual([[1]])
  })

  it("preserva a precisão de numeric e int8", async () => {
    const result = await run(
      ro,
      "select 9007199254740993::int8 as big, 12345678901234567890.123456789::numeric as dec, 0.1::float8 as f"
    )
    expect(result.rows[0]).toEqual([
      "9007199254740993",
      "12345678901234567890.123456789",
      0.1,
    ])
  })

  it("introspecta schemas, colunas, chaves e índices", async () => {
    const schema = await ro.introspect()
    expect(schema.serverVersion).toMatch(/PostgreSQL 1\d/)
    const pedidos = schema.tables.find(
      (t) => t.schema === "loja" && t.name === "pedidos"
    )!
    expect(pedidos.comment).toBe("Pedidos dos últimos dois anos")
    expect(pedidos.columns.find((c) => c.name === "id")?.primaryKey).toBe(true)
    expect(pedidos.foreignKeys[0]?.references.table).toBe("clientes")
    expect(pedidos.indexes.map((i) => i.name)).toContain("pedidos_data_idx")
    const view = schema.tables.find((t) => t.name === "vendas_mensais")!
    expect(view.type).toBe("view")
    expect(view.columns.map((c) => c.name)).toEqual([
      "mes",
      "categoria",
      "receita",
      "pedidos",
    ])
  })

  it("explain não executa a query", async () => {
    const plan = await ro.explain(compileSql("select pg_sleep(30)", {}), {
      timeoutMs: 2000,
    })
    expect(plan.plan).toMatch(/Result/)
  })

  it("traduz falha de conexão", async () => {
    const bad = new PostgresAdapter(demoConfig({ password: "errada" }))
    await expect(bad.testConnection()).rejects.toThrow(/recusados/)
    await bad.close()
  })
})
