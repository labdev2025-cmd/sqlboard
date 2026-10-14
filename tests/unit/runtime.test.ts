import { describe, expect, it } from "vitest"

import { newDocument, type AppQuery } from "@/lib/app-schema"
import { defaultProps } from "@/lib/widgets/registry"
import {
  initialVariables,
  queriesUsedBy,
  resolveParams,
} from "@/features/app-runtime/use-app-runtime"

const CONN = "6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f"
const base: Omit<AppQuery, "id" | "name" | "sql" | "params"> = {
  connectionId: CONN,
  runMode: "auto",
  sourceQueryId: null,
  cacheTtlSeconds: 0,
  paramBindings: {},
}

describe("runtime da tela", () => {
  const ufs: AppQuery = {
    ...base,
    id: "q1",
    name: "ufs",
    sql: "select uf from t",
    params: [],
  }
  const detail: AppQuery = {
    ...base,
    id: "q2",
    name: "detalhe",
    sql: "select * from t where uf = :uf and ano = :ano",
    params: [
      { name: "uf", type: "text", required: true },
      { name: "ano", type: "integer", required: false, default: "2026" },
    ],
    paramBindings: { uf: "{{tabela1.selectedRow.uf}}" },
  }

  it("binding vence a variável; sem binding usa a variável", () => {
    const scope = { tabela1: { selectedRow: { uf: "CE" } }, vars: {} }
    expect(resolveParams(detail, { uf: "SP", ano: "2025" }, scope)).toEqual({
      uf: "CE",
      ano: "2025",
    })
    expect(
      resolveParams(detail, {}, { tabela1: { selectedRow: null } })
    ).toEqual({ uf: null, ano: null })
  })

  it("valores de binding viram dados (listas e números), nunca código", () => {
    const multi: AppQuery = {
      ...detail,
      paramBindings: { uf: "{{sel.value}}" },
    }
    expect(
      resolveParams(multi, {}, { sel: { value: ["CE", "SP"] } }).uf
    ).toEqual(["CE", "SP"])
    expect(resolveParams(multi, {}, { sel: { value: 7 } }).uf).toBe(7)
    expect(resolveParams(multi, {}, { sel: { value: { a: 1 } } }).uf).toBe(
      '{"a":1}'
    )
  })

  it("descobre as queries usadas pela página e pelas origens dos parâmetros", () => {
    const doc = newDocument({ id: "a", name: "A" })
    doc.queries.push(ufs, detail)
    doc.pages[0]!.widgets.push({
      id: "tabela2",
      type: "table",
      grid: { x: 0, y: 0, w: 12, h: 4 },
      props: defaultProps("table"),
      bindings: { data: "{{detalhe.data}}" },
    })
    expect(queriesUsedBy(doc.pages[0]!, doc).map((q) => q.name)).toEqual([
      "detalhe",
    ])
    detail.paramBindings = { uf: "{{ufs.data[0].uf}}" }
    expect(
      queriesUsedBy(doc.pages[0]!, doc)
        .map((q) => q.name)
        .sort()
    ).toEqual(["detalhe", "ufs"])
    expect(initialVariables(doc, { uf: "RJ" })).toEqual({
      ano: "2026",
      uf: "RJ",
    })
  })
})
