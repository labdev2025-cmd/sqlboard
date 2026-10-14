import { describe, expect, it } from "vitest"

import {
  analyzeSql,
  compileSql,
  extractParamNames,
  inferParamType,
  SqlParamError,
  syncParams,
  tokenize,
} from "@/lib/sql-params"

const names = (
  sql: string,
  dialect?: Parameters<typeof extractParamNames>[1]
) => extractParamNames(sql, dialect)

describe("tokenizador de parâmetros", () => {
  it("detecta :nome e {{nome}} como o mesmo parâmetro", () => {
    expect(names("select * from t where a = :uf and b = {{ uf }}")).toEqual([
      "uf",
    ])
    expect(names("select :a, {{b}}, :c_1")).toEqual(["a", "b", "c_1"])
  })

  it("ignora strings com '' escapado", () => {
    expect(names("select ':x', 'it''s :y', :z")).toEqual(["z"])
    expect(names("select 'a'':b''c', :ok")).toEqual(["ok"])
  })

  it("trata E'...' com barra invertida", () => {
    expect(names("select E'a\\' :x', :y")).toEqual(["y"])
  })

  it("ignora identificadores entre aspas duplas", () => {
    expect(names('select "col:x", "a""b:c" from t where d = :d')).toEqual(["d"])
  })

  it("ignora comentários de linha e de bloco (inclusive aninhados)", () => {
    expect(names("select 1 -- :a\nwhere b = :b")).toEqual(["b"])
    expect(names("select /* :a */ 1 /* x /* :n */ :y */ , :c")).toEqual(["c"])
    expect(names("select 1 -- :fim")).toEqual([])
  })

  it("ignora dollar-quoting $$ e $tag$", () => {
    expect(names("select $$ :a $$, :b")).toEqual(["b"])
    expect(names("select $fn$ :a $x$ :b $fn$, :c")).toEqual(["c"])
    expect(names("select $1, :p")).toEqual(["p"])
  })

  it("ignora o cast ::tipo e :=", () => {
    expect(names("select :d::date, x::text, '1'::int")).toEqual(["d"])
    expect(names("select f(a := 1, b := :v)")).toEqual(["v"])
    expect(names("select now()::timestamp(0)")).toEqual([])
  })

  it("não confunde identificadores com parâmetros", () => {
    expect(names("select a:b from t")).toEqual([])
    expect(names("select arr[1:2] from t")).toEqual([])
  })

  it("respeita crases (MySQL), # comentário e [colchetes] (SQL Server)", () => {
    expect(names("select `a:b`, :c # :d", "mysql")).toEqual(["c"])
    expect(names("select [col:x], :y from t", "mssql")).toEqual(["y"])
  })

  it("rejeita {{ sem fechamento e nomes inválidos", () => {
    expect(() => tokenize("select {{ a")).toThrow(SqlParamError)
    expect(() => tokenize("select {{ 1a }}")).toThrow(/inválido/)
  })

  it("valida cláusulas opcionais", () => {
    expect(
      analyzeSql("select 1 where 1=1 [[and a = :a]] [[and b = :b and c = :c]]")
    ).toEqual({ params: ["a", "b", "c"], optionalClauses: [["a"], ["b", "c"]] })
    expect(() => analyzeSql("[[ :a [[ :b ]] ]]")).toThrow(/aninhadas/)
    expect(() => analyzeSql("select 1 [[ and x ]]")).toThrow(/pelo menos um/)
    expect(() => analyzeSql("select 1 [[ and :x")).toThrow(/sem ]]/)
    expect(() => analyzeSql("select 1 ]]")).toThrow(/sem \[\[/)
  })
})

describe("compilador por dialeto", () => {
  const sql = "select * from t where a = :a and b = {{b}} and c = :a"

  it("Postgres usa $n e reutiliza o parâmetro repetido", () => {
    const out = compileSql(sql, { a: "1", b: "x" })
    expect(out.sql).toBe("select * from t where a = $1 and b = $2 and c = $1")
    expect(out.values).toEqual(["1", "x"])
  })

  it("MySQL e SQLite usam ? e repetem o valor", () => {
    for (const dialect of ["mysql", "sqlite"] as const) {
      const out = compileSql(sql, { a: "1", b: "x" }, { dialect })
      expect(out.sql).toBe("select * from t where a = ? and b = ? and c = ?")
      expect(out.values).toEqual(["1", "x", "1"])
    }
  })

  it("SQL Server usa @pN e Oracle usa :N", () => {
    expect(compileSql(sql, { a: "1", b: "x" }, { dialect: "mssql" }).sql).toBe(
      "select * from t where a = @p1 and b = @p2 and c = @p1"
    )
    const oracle = compileSql(sql, { a: "1", b: "x" }, { dialect: "oracle" })
    expect(oracle.sql).toBe(
      "select * from t where a = :1 and b = :2 and c = :3"
    )
    expect(oracle.values).toEqual(["1", "x", "1"])
  })

  it("nunca concatena valores (tentativa de injeção vira valor)", () => {
    const evil = "x'; drop table t; --"
    const out = compileSql("select * from t where nome = :nome", { nome: evil })
    expect(out.sql).toBe("select * from t where nome = $1")
    expect(out.sql).not.toContain("drop")
    expect(out.values).toEqual([evil])
  })

  it("preserva o SQL protegido (strings, comentários, casts)", () => {
    const out = compileSql("select ':a', x::int /* :b */ from t where y = :y", {
      y: "1",
    })
    expect(out.sql).toBe("select ':a', x::int /* :b */ from t where y = $1")
  })

  it("remove a cláusula opcional quando o parâmetro está vazio", () => {
    const text =
      "select * from t where 1=1 [[ and status = :status ]] [[ and uf = :uf ]]"
    const out = compileSql(text, { status: "", uf: "CE" })
    expect(out.sql).toBe("select * from t where 1=1   and uf = $1 ")
    expect(out.values).toEqual(["CE"])
    expect(out.removedClauses).toBe(1)
    const none = compileSql(text, {})
    expect(none.sql).toBe("select * from t where 1=1  ")
    expect(none.values).toEqual([])
  })

  it("exige parâmetros obrigatórios", () => {
    expect(() =>
      compileSql(
        "select :a",
        {},
        { params: [{ name: "a", type: "text", required: true }] }
      )
    ).toThrow(/Preencha/)
  })

  it("converte tipos e valida", () => {
    const params = [
      { name: "n", type: "integer" as const, required: false },
      { name: "v", type: "number" as const, required: false },
      { name: "d", type: "date" as const, required: false },
      { name: "b", type: "boolean" as const, required: false },
    ]
    const out = compileSql(
      "select :n, :v, :d, :b",
      { n: "42", v: "10,5", d: "2026-02-28", b: "sim" },
      { params }
    )
    expect(out.values).toEqual([42, 10.5, "2026-02-28", true])
    const big = compileSql(
      "select :n, :v",
      { n: "90071992547409930", v: "0.10000000000000000001" },
      { params }
    )
    expect(big.values).toEqual(["90071992547409930", "0.10000000000000000001"])
    expect(() => compileSql("select :n", { n: "1.5" }, { params })).toThrow(
      /inteiro/
    )
    expect(() =>
      compileSql("select :d", { d: "2026-02-30" }, { params })
    ).toThrow(/data/)
    expect(() => compileSql("select :b", { b: "talvez" }, { params })).toThrow(
      /sim ou não/
    )
  })

  it("multi: array no Postgres e expansão nos demais", () => {
    const params = [{ name: "s", type: "multi" as const, required: false }]
    const pg = compileSql(
      "select * from t where s = any(:s)",
      { s: ["a", "b"] },
      { params }
    )
    expect(pg.sql).toBe("select * from t where s = any($1)")
    expect(pg.values).toEqual([["a", "b"]])
    const my = compileSql(
      "select * from t where s in (:s)",
      { s: ["a", "b"] },
      { params, dialect: "mysql" }
    )
    expect(my.sql).toBe("select * from t where s in (?, ?)")
    expect(my.values).toEqual(["a", "b"])
    const opt = compileSql(
      "select 1 [[ where s in (:s) ]]",
      { s: [] },
      { params, dialect: "mysql" }
    )
    expect(opt.sql).toBe("select 1 ")
  })

  it("list e multi validam opções fixas", () => {
    const params = [
      {
        name: "l",
        type: "list" as const,
        required: false,
        options: [{ value: "a" }],
      },
    ]
    expect(() => compileSql("select :l", { l: "z" }, { params })).toThrow(
      /opção/
    )
    expect(compileSql("select :l", { l: "a" }, { params }).values).toEqual([
      "a",
    ])
  })
})

describe("inferência de tipo", () => {
  it("usa nome e contexto", () => {
    expect(inferParamType("data_inicio", "select :data_inicio")).toBe("date")
    expect(inferParamType("criado_em", "select :criado_em")).toBe("date")
    expect(inferParamType("cliente_id", "select :cliente_id")).toBe("integer")
    expect(inferParamType("valor_minimo", "select :valor_minimo")).toBe(
      "number"
    )
    expect(inferParamType("ativo", "select :ativo")).toBe("boolean")
    expect(inferParamType("uf", "select * from t where uf in (:uf)")).toBe(
      "multi"
    )
    expect(inferParamType("x", "select * from t limit :x")).toBe("integer")
    expect(inferParamType("nome_de_cliente", "select :nome_de_cliente")).toBe(
      "text"
    )
  })

  it("sincroniza definições preservando ajustes do usuário", () => {
    const synced = syncParams("select :a [[ where b = :b ]]", [
      { name: "a", type: "integer", required: false, label: "A" },
      { name: "old", type: "text", required: false },
    ])
    expect(synced).toEqual([
      { name: "a", type: "integer", required: false, label: "A" },
      { name: "b", type: "text", required: false },
    ])
  })
})

describe("comando único e somente leitura", () => {
  it("conta comandos ignorando ; em strings e comentários", async () => {
    const { countStatements, assertSingleReadStatement, leadingKeyword } =
      await import("@/lib/sql-params")
    expect(countStatements("select 1;")).toBe(1)
    expect(countStatements("select ';' -- ;\n")).toBe(1)
    expect(countStatements("select 1; drop table t")).toBe(2)
    expect(
      leadingKeyword("/* c */ ( -- x\n WITH a as (select 1) select * from a")
    ).toBe("with")
    expect(() => assertSingleReadStatement("select 1; select 2")).toThrow(
      /único comando/
    )
    expect(() => assertSingleReadStatement("delete from t")).toThrow(/leitura/)
    expect(() => assertSingleReadStatement("  ")).toThrow(/vazia/)
    expect(() => assertSingleReadStatement("select $$;$$")).not.toThrow()
  })
})
