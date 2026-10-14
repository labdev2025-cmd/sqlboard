import { describe, expect, it } from "vitest"

import {
  appDocumentSchema,
  migrateDocument,
  newDocument,
  type AppDocument,
  type AppQuery,
} from "@/lib/app-schema"
import type { ResultColumn } from "@/lib/data-types"
import { defaultProps, propFields, WIDGET_TYPES } from "@/lib/widgets/registry"
import { generateScreen, suggestWidgets } from "@/lib/widgets/suggest"

const CONN = "6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f"

function doc(): AppDocument {
  const base = newDocument({ id: "a1", name: "Frota" })
  base.queries.push({
    id: "q1",
    name: "frota",
    connectionId: CONN,
    sql: "select tipo, total from frota where uf = :uf",
    params: [{ name: "uf", type: "text", required: true, default: "CE" }],
    runMode: "auto",
    sourceQueryId: null,
    cacheTtlSeconds: 0,
    paramBindings: {},
  })
  base.pages[0]!.widgets.push({
    id: "w1",
    type: "bar-chart",
    grid: { x: 0, y: 0, w: 6, h: 8 },
    props: {
      ...defaultProps("bar-chart"),
      title: "Veículos por tipo",
      x: "tipo",
      y: ["total"],
    },
    bindings: { data: "{{frota.data}}" },
  })
  return base
}

describe("schema do documento de tela", () => {
  it("valida o documento do PROMPT.md", () => {
    expect(appDocumentSchema.parse(doc()).pages[0]!.widgets[0]!.type).toBe(
      "bar-chart"
    )
  })

  it("rejeita tipo desconhecido, props inválidas e posição fora da grade", () => {
    const unknown = doc() as unknown as {
      pages: { widgets: { type: string }[] }[]
    }
    unknown.pages[0]!.widgets[0]!.type = "mapa-3d"
    expect(appDocumentSchema.safeParse(unknown).success).toBe(false)

    const badProps = doc()
    ;(badProps.pages[0]!.widgets[0]!.props as Record<string, unknown>).y =
      "total"
    expect(appDocumentSchema.safeParse(badProps).success).toBe(false)

    const outside = doc()
    outside.pages[0]!.widgets[0]!.grid = { x: 8, y: 0, w: 6, h: 2 }
    const result = appDocumentSchema.safeParse(outside)
    expect(result.success).toBe(false)
    expect(JSON.stringify(result.error?.issues)).toContain("12 colunas")
  })

  it("exige nomes únicos de query e de componente", () => {
    const dup = doc()
    dup.queries.push({ ...dup.queries[0]!, id: "q2" })
    expect(appDocumentSchema.safeParse(dup).success).toBe(false)
    const clash = doc()
    clash.pages[0]!.widgets[0]!.id = "frota"
    expect(appDocumentSchema.safeParse(clash).success).toBe(false)
  })

  it("migra v1 → v2 (paramBindings) e recusa versão futura", () => {
    expect(migrateDocument(doc()).schemaVersion).toBe(2)
    const v1 = JSON.parse(JSON.stringify(doc())) as Record<string, unknown> & {
      queries: Record<string, unknown>[]
    }
    v1.schemaVersion = 1
    for (const q of v1.queries) delete q.paramBindings
    ;(v1.queries[0]!.params as { default?: unknown }[])[0]!.default =
      "{{tabela1.selectedRow.uf}}"
    const migrated = migrateDocument(v1)
    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.queries[0]!.paramBindings).toEqual({
      uf: "{{tabela1.selectedRow.uf}}",
    })
    expect(migrated.queries[0]!.params[0]!.default).toBeNull()
    // Stored snapshots are not rewritten: migration runs on load.
    expect(v1.schemaVersion).toBe(1)
    expect(() => migrateDocument({ ...doc(), schemaVersion: 99 })).toThrow(
      /mais nova/
    )
    expect(() => migrateDocument(null)).toThrow()
  })

  it("todo widget tem props padrão válidas e campos descritos para o painel", () => {
    for (const type of WIDGET_TYPES) {
      expect(() => defaultProps(type)).not.toThrow()
      expect(propFields(type).length).toBeGreaterThan(0)
      for (const field of propFields(type))
        expect(field.meta.label).toBeTruthy()
    }
  })
})

const col = (name: string, kind: ResultColumn["kind"]): ResultColumn => ({
  name,
  kind,
  nativeType: kind,
})

describe("sugestão por tipo de coluna", () => {
  it("uma linha numérica vira KPI", () => {
    const types = suggestWidgets(
      [col("total", "integer"), col("media", "decimal")],
      1
    ).map((s) => s.type)
    expect(types.filter((t) => t === "kpi")).toHaveLength(2)
  })

  it("data + número vira linha; categoria + número vira barras e pizza", () => {
    expect(
      suggestWidgets([col("mes", "date"), col("receita", "decimal")], 24).map(
        (s) => s.type
      )
    ).toContain("line-chart")
    const cat = suggestWidgets(
      [col("categoria", "text"), col("receita", "decimal")],
      6
    ).map((s) => s.type)
    expect(cat).toEqual(
      expect.arrayContaining(["bar-chart", "pie-chart", "table"])
    )
    const many = suggestWidgets(
      [col("categoria", "text"), col("receita", "decimal")],
      40
    ).map((s) => s.type)
    expect(many).not.toContain("pie-chart")
  })

  it("o resto vira tabela", () => {
    expect(
      suggestWidgets([col("nome", "text"), col("email", "text")], 50).map(
        (s) => s.type
      )
    ).toEqual(["table"])
  })
})

describe("gerar tela automática", () => {
  it("cria filtros para os parâmetros, gráfico e tabela, sem sobreposição", () => {
    const query: AppQuery = {
      ...doc().queries[0]!,
      params: [
        {
          name: "uf",
          type: "list",
          required: true,
          options: [{ value: "CE", label: "Ceará" }],
        },
        { name: "inicio", type: "date", required: false },
      ],
    }
    const widgets = generateScreen(
      query,
      [col("mes", "date"), col("receita", "decimal")],
      12
    )
    expect(widgets.map((w) => w.type)).toEqual([
      "select",
      "date-input",
      "line-chart",
      "table",
    ])
    expect(widgets[0]!.props).toMatchObject({
      param: "uf",
      options: "CE|Ceará",
    })
    expect(widgets.find((w) => w.type === "line-chart")!.bindings.data).toBe(
      "{{frota.data}}"
    )
    const cells = new Set<string>()
    for (const w of widgets) {
      expect(w.grid.x + w.grid.w).toBeLessThanOrEqual(12)
      for (let x = w.grid.x; x < w.grid.x + w.grid.w; x++)
        for (let y = w.grid.y; y < w.grid.y + w.grid.h; y++) {
          expect(cells.has(`${x},${y}`)).toBe(false)
          cells.add(`${x},${y}`)
        }
    }
    const full = doc()
    full.pages[0]!.widgets = widgets
    expect(appDocumentSchema.safeParse(full).success).toBe(true)
  })
})
