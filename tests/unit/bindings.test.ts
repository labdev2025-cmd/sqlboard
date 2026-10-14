import { describe, expect, it } from "vitest"

import {
  bindingRoots,
  evaluateBinding,
  parsePath,
  validateBindings,
} from "@/lib/bindings"

const scope = {
  vendas: {
    data: [{ total: 10, "nome completo": "Ana" }, { total: 20 }],
    rowCount: 2,
  },
  tabela1: { selectedRow: { cliente_id: 7 } },
  filtro: { value: "CE" },
}

describe("avaliador de bindings", () => {
  it("lê caminhos com ponto, índice e chave entre aspas", () => {
    expect(evaluateBinding("{{vendas.data}}", scope)).toBe(scope.vendas.data)
    expect(evaluateBinding("{{ vendas.data[1].total }}", scope)).toBe(20)
    expect(evaluateBinding("{{vendas.data[0]['nome completo']}}", scope)).toBe(
      "Ana"
    )
    expect(evaluateBinding("{{vendas.data.length}}", scope)).toBe(2)
    expect(evaluateBinding("{{tabela1.selectedRow.cliente_id}}", scope)).toBe(7)
  })

  it("interpola texto", () => {
    expect(
      evaluateBinding(
        "UF: {{filtro.value}} ({{vendas.rowCount}} linhas)",
        scope
      )
    ).toBe("UF: CE (2 linhas)")
    expect(evaluateBinding("{{nada.aqui}} ok", scope)).toBe(" ok")
  })

  it("bloqueia tentativas de execução de código", () => {
    const attacks = [
      "{{ constructor.constructor('return process')() }}",
      "{{ vendas.constructor }}",
      "{{ vendas.__proto__ }}",
      "{{ __proto__.polluted }}",
      "{{ vendas.data.map }}",
      "{{ vendas.data.toString }}",
      "{{ this }}",
      "{{ globalThis.process }}",
      "{{ eval('1+1') }}",
      "{{ vendas.data[0].total + 1 }}",
      "{{ (() => 1)() }}",
      "{{ `${1}` }}",
      "{{ import('fs') }}",
      "{{ vendas['constructor']['constructor'] }}",
    ]
    for (const attack of attacks) {
      const result = evaluateBinding(attack, scope)
      expect(typeof result === "function").toBe(false)
      // Either nothing, or the literal text untouched: never an evaluated value.
      expect([undefined, "", attack]).toContain(result)
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it("não lê de objetos com protótipo próprio (classes, funções)", () => {
    class Secret {
      key = "x"
    }
    expect(evaluateBinding("{{s.key}}", { s: new Secret() })).toBeUndefined()
    expect(evaluateBinding("{{f.name}}", { f: () => 1 })).toBeUndefined()
  })

  it("valida e lista dependências", () => {
    expect(() => parsePath("a..b")).toThrow()
    expect(validateBindings("{{ a.b }} {{ 1+1 }}")).toHaveLength(1)
    expect(bindingRoots("{{vendas.data}} e {{filtro.value}}")).toEqual([
      "vendas",
      "filtro",
    ])
  })
})
