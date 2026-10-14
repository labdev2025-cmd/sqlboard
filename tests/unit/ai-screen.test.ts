import { describe, expect, it } from "vitest"

import {
  buildScreenPrompt,
  documentJsonSchema,
  parseScreenAnswer,
  ScreenAnswerError,
  widgetCatalog,
} from "@/lib/ai-prompt/screen"
import { newDocument } from "@/lib/app-schema"

const appId = "11111111-1111-4111-8111-111111111111"
const connectionId = "22222222-2222-4222-8222-222222222222"

function answerDoc() {
  const doc = newDocument({ id: "outro-id", name: "Gerada" })
  doc.queries.push({
    id: "q1",
    name: "vendas",
    connectionId,
    sql: "select mes, total from vendas where uf = :uf",
    params: [{ name: "uf", type: "text", required: true }],
    runMode: "auto",
    sourceQueryId: null,
    cacheTtlSeconds: 0,
    paramBindings: {},
  })
  return doc
}

describe("gerar tela com IA", () => {
  it("monta o prompt com pedido, regras, schema e documento atual", () => {
    const prompt = buildScreenPrompt({
      request: "Vendas por mês",
      dialect: "postgres",
      connectionId,
      serverVersion: "PostgreSQL 16",
      tables: [
        {
          schema: "loja",
          name: "vendas",
          type: "table",
          comment: null,
          columns: [
            {
              name: "total",
              type: "numeric",
              kind: "decimal",
              nullable: false,
              comment: null,
              primaryKey: false,
            },
          ],
          foreignKeys: [],
          indexes: [],
        },
      ],
      current: newDocument({ id: appId, name: "Atual" }),
    })
    expect(prompt).toContain("Vendas por mês")
    expect(prompt).toContain(`connectionId a usar: ${connectionId}`)
    expect(prompt).toContain("Tabela loja.vendas")
    expect(prompt).toContain('"name": "Atual"')
    expect(prompt).toContain("Nunca coloque valores digitados")
    expect(widgetCatalog()).toContain("bar-chart")
    expect(JSON.stringify(documentJsonSchema())).toContain("schemaVersion")
  })

  it("valida a resposta e mantém o id da tela", () => {
    const text = `Aqui está:\n\`\`\`json\n${JSON.stringify(answerDoc())}\n\`\`\`\nFim.`
    const doc = parseScreenAnswer(text, { appId })
    expect(doc.app.id).toBe(appId)
    expect(doc.queries[0]!.name).toBe("vendas")
    // Bare JSON (no fence) works too.
    expect(
      parseScreenAnswer(JSON.stringify(answerDoc()), { appId }).app.id
    ).toBe(appId)
  })

  it("explica respostas inválidas", () => {
    expect(() => parseScreenAnswer("não sei", { appId })).toThrow(/JSON válido/)
    const bad = answerDoc() as unknown as { pages: unknown[] }
    bad.pages = []
    try {
      parseScreenAnswer(JSON.stringify(bad), { appId })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ScreenAnswerError)
      expect((error as ScreenAnswerError).issues[0]!.path).toBe("pages")
    }
    expect(() =>
      parseScreenAnswer(JSON.stringify({ ...answerDoc(), schemaVersion: 42 }), {
        appId,
      })
    ).toThrow(/mais nova/)
  })
})
