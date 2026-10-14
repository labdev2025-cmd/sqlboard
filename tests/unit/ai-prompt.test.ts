import { describe, expect, it } from "vitest"

import {
  buildAiPrompt,
  checkImprovedQuery,
  compareRuns,
  hasTopLevelOrderBy,
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

  it("nunca contém linhas de dados nem valores de parâmetros", () => {
    // Even if a caller passes the whole result (with rows) as lastRun, or
    // the current parameter values, only the metrics reach the prompt.
    const lastRun = {
      durationMs: 42,
      rowCount: 2,
      truncated: false,
      columns: [{ name: "cpf", kind: "text", nativeType: "text" }],
      rows: [["111.222.333-44"], ["Maria Exemplar"]],
    }
    const text = buildAiPrompt({
      sql: SQL,
      dialect: "postgres",
      context: {
        tables: [pedidos],
        lastRun,
        values: { inicio: "2026-02-03", status: "segredo-do-filtro" },
      } as Parameters<typeof buildAiPrompt>[0]["context"],
      include: { plan: true },
    })
    expect(text).toContain("Tempo: 42 ms · Linhas: 2")
    expect(text).not.toContain("111.222.333-44")
    expect(text).not.toContain("Maria Exemplar")
    expect(text).not.toContain("cpf")
    expect(text).not.toContain("2026-02-03")
    expect(text).not.toContain("segredo-do-filtro")
  })

  it("não vaza nome da conexão, host nem credenciais do contexto da tela", () => {
    // What the editor has at hand: the connection view, the introspected
    // schema (with unreferenced tables) and the parameters.
    const connection = {
      name: "Conexão Produção Financeiro",
      host: "db-interno.exemplo.test",
      port: 6543,
      username: "usuario_relatorios",
      password: "Senha#Super$ecreta",
    }
    const schema = {
      serverVersion: "PostgreSQL 16.4",
      introspectedAt: "2026-10-14T12:00:00Z",
      tables: [
        pedidos,
        {
          ...semIndice,
          name: "credenciais",
          comment: `Acesso a ${connection.host} com ${connection.password}`,
        },
      ],
    }
    const text = buildAiPrompt({
      sql: SQL,
      dialect: "postgres",
      context: {
        ...connection,
        serverVersion: schema.serverVersion,
        tables: referencedTables(SQL, schema.tables, "postgres"),
        params: [{ name: "inicio", type: "date", required: true }],
        connection,
      } as Parameters<typeof buildAiPrompt>[0]["context"],
      include: { plan: true },
    })
    expect(text).toContain("### Tabela loja.pedidos")
    expect(text).not.toContain("credenciais")
    for (const secret of [
      connection.name,
      connection.host,
      String(connection.port),
      connection.username,
      connection.password,
    ]) {
      expect(text).not.toContain(secret)
    }
  })

  it("caso completo: cláusulas opcionais, parâmetros, índices e plano (snapshot)", () => {
    const text = buildAiPrompt({
      sql: SQL,
      dialect: "postgres",
      context: {
        serverVersion: "PostgreSQL 16.4",
        tables: [pedidos],
        params: [
          { name: "inicio", type: "date", required: true },
          { name: "status", type: "text", required: false },
        ],
        lastRun: { durationMs: 1234, rowCount: 5000, truncated: true },
        plan: "Index Scan using pedidos_data_idx on pedidos  (cost=0.29..8.31 rows=1 width=4)",
      },
      include: { plan: true },
    })
    expect(text).toContain("(resultado truncado pelo limite de linhas)")
    expect(text).toContain("## Plano de execução (EXPLAIN, sem ANALYZE)")
    expect(text).toMatchSnapshot()
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
    // Without ORDER BY the order does not matter; with it, it does.
    expect(compareRuns(base, { ...base, rows: [[2], [1]] }).verdict).toBe(
      "identical"
    )
    const reordered = compareRuns(
      base,
      { ...base, rows: [[2], [1]] },
      { ordered: true }
    )
    expect(reordered.verdict).toBe("different")
    expect(reordered.reasons).toContain("Mesmas linhas, mas em outra ordem.")
    expect(hasTopLevelOrderBy("select a from t order by a")).toBe(true)
    expect(
      hasTopLevelOrderBy("select * from (select a from t order by a) x")
    ).toBe(false)
    expect(hasTopLevelOrderBy("select 'order by' as x -- order by")).toBe(false)
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
