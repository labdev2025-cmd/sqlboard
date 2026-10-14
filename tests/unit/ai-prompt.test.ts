import { describe, expect, it } from "vitest"

import {
  buildAiPrompt,
  checkImprovedQuery,
  compareRuns,
  extractSqlFromResponse,
  referencedTables,
} from "@/lib/ai-prompt"
import type { SchemaTable } from "@/lib/data-types"

const pedidos: SchemaTable = {
  schema: "loja",
  name: "pedidos",
  type: "table",
  comment: "Pedidos",
  columns: [
    {
      name: "id",
      type: "integer",
      kind: "integer",
      nullable: false,
      comment: null,
      primaryKey: true,
    },
    {
      name: "data_pedido",
      type: "timestamp with time zone",
      kind: "datetime",
      nullable: false,
      comment: null,
      primaryKey: false,
    },
  ],
  foreignKeys: [
    {
      columns: ["cliente_id"],
      references: { schema: "loja", table: "clientes", columns: ["id"] },
    },
  ],
  indexes: [
    {
      name: "pedidos_data_idx",
      definition:
        "CREATE INDEX pedidos_data_idx ON loja.pedidos USING btree (data_pedido)",
    },
  ],
}
const semIndice: SchemaTable = {
  ...pedidos,
  name: "categorias",
  indexes: [],
  foreignKeys: [],
}

const SQL =
  "select id from loja.pedidos where data_pedido >= :inicio [[ and status = :status ]]"

describe("prompt de IA", () => {
  const prompt = buildAiPrompt({
    sql: SQL,
    dialect: "postgres",
    context: {
      serverVersion: "PostgreSQL 16.4",
      tables: [pedidos],
      params: [{ name: "inicio", type: "date", required: true }],
      lastRun: { durationMs: 42, rowCount: 10, truncated: false },
      plan: "Seq Scan on pedidos",
    },
  })

  it("contém instruções, contexto e a query num bloco sql", () => {
    expect(prompt).toContain("SEM mudar o resultado")
    expect(prompt).toContain(
      "Responda SOMENTE com a query final dentro de um bloco ```sql```"
    )
    expect(prompt).toContain("PostgreSQL 16.4")
    expect(prompt).toContain("CREATE INDEX pedidos_data_idx")
    expect(prompt).toContain("- :inicio — Data, obrigatório")
    expect(prompt).toContain(
      ":status — Texto, dentro de cláusula opcional [[ ]]"
    )
    expect(prompt).toContain("Tempo: 42 ms · Linhas: 10")
    expect(prompt.trimEnd().endsWith("```sql\n" + SQL + "\n```")).toBe(true)
  })

  it("omite o plano por padrão e respeita as caixas de seleção", () => {
    expect(prompt).not.toContain("Seq Scan")
    const minimal = buildAiPrompt({
      sql: SQL,
      dialect: "postgres",
      context: {
        serverVersion: "PostgreSQL 16.4",
        tables: [pedidos],
        plan: "Seq Scan",
      },
      include: {
        version: false,
        tables: false,
        params: false,
        metrics: false,
        plan: true,
      },
    })
    expect(minimal).not.toContain("PostgreSQL 16.4")
    expect(minimal).not.toContain("Colunas:")
    expect(minimal).toContain("Seq Scan")
  })

  it("nunca contém linhas de dados nem credenciais", () => {
    const keys = Object.keys({ sql: 1, dialect: 1, context: 1, include: 1 })
    expect(keys).not.toContain("rows")
    expect(prompt).not.toMatch(/senha|password|host|localhost|5432/i)
  })

  it("trata casos sem índices e sem parâmetros (snapshot)", () => {
    const text = buildAiPrompt({
      sql: "select * from loja.categorias",
      dialect: "postgres",
      context: { tables: [semIndice] },
    })
    expect(text).toContain("Índices:\n- nenhum")
    expect(text).toContain("A query não tem parâmetros.")
    expect(text).toMatchSnapshot()
  })

  it("detecta tabelas referenciadas", () => {
    expect(
      referencedTables("select * from loja.pedidos p", [
        pedidos,
        semIndice,
      ]).map((t) => t.name)
    ).toEqual(["pedidos"])
    expect(referencedTables("select 'pedidos' -- pedidos", [pedidos])).toEqual(
      []
    )
  })
})

describe("resposta da IA", () => {
  it("extrai o primeiro bloco sql, ou o texto inteiro", () => {
    expect(
      extractSqlFromResponse(
        "Aqui:\n```sql\nselect 1\n```\n```sql\nselect 2\n```"
      )
    ).toBe("select 1")
    expect(extractSqlFromResponse("```\nselect 3\n```")).toBe("select 3")
    expect(extractSqlFromResponse("  select 4  ")).toBe("select 4")
  })

  it("valida comando único e parâmetros", () => {
    expect(
      checkImprovedQuery(SQL, SQL.replace("select id", "select p.id")).ok
    ).toBe(true)
    const missing = checkImprovedQuery(
      SQL,
      "select id from loja.pedidos where data_pedido >= :inicio"
    )
    expect(missing.missingParams).toEqual(["status"])
    expect(missing.warnings.join(" ")).toMatch(/sumiram/)
    expect(missing.warnings.join(" ")).toMatch(/opcionais/)
    const extra = checkImprovedQuery(SQL, SQL + " and x = :novo")
    expect(extra.extraParams).toEqual(["novo"])
    expect(checkImprovedQuery(SQL, "select 1; select 2").ok).toBe(false)
    expect(checkImprovedQuery(SQL, "").ok).toBe(false)
  })

  it("compara execuções por hash das linhas", () => {
    const columns = [
      { name: "a", kind: "integer" as const, nativeType: "int4" },
    ]
    const base = { columns, rows: [[1], [2]], truncated: false }
    expect(compareRuns(base, { ...base, rows: [[2], [1]] }).verdict).toBe(
      "identical"
    )
    expect(compareRuns(base, { ...base, rows: [[1], [3]] }).verdict).toBe(
      "different"
    )
    expect(
      compareRuns(base, { ...base, columns: [{ ...columns[0]!, name: "b" }] })
        .verdict
    ).toBe("different")
    expect(compareRuns(base, { ...base, truncated: true }).verdict).toBe(
      "inconclusive"
    )
  })
})
