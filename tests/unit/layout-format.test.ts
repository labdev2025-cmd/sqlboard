import { describe, expect, it } from "vitest"

import type { Widget } from "@/lib/app-schema"
import { compareCells, compareDecimalStrings } from "@/lib/format"
import type { Cell, ColumnKind } from "@/lib/data-types"
import { stackedLayout } from "@/lib/widgets/layout"
import { defaultProps } from "@/lib/widgets/registry"

function text(id: string, x: number, y: number, h = 4): Widget {
  return {
    id,
    type: "text",
    grid: { x, y, w: 6, h },
    props: defaultProps("text"),
    bindings: {},
  }
}

describe("layout empilhado (celular)", () => {
  it("ordena por linha e depois por coluna, empilhando sem sobreposição", () => {
    const widgets = [
      text("rodape", 0, 20, 3),
      text("direita", 6, 0, 5),
      text("meio", 0, 8),
      text("esquerda", 0, 0, 1),
    ]
    const layout = stackedLayout(widgets)
    expect(layout.map((item) => item.i)).toEqual([
      "esquerda",
      "direita",
      "meio",
      "rodape",
    ])
    // Altura mínima 2; cada item começa onde o anterior termina.
    expect(layout.map((item) => [item.y, item.h])).toEqual([
      [0, 2],
      [2, 5],
      [7, 4],
      [11, 3],
    ])
    expect(layout.every((item) => item.x === 0 && item.w === 1)).toBe(true)
    expect(layout.every((item) => item.static)).toBe(true)
  })

  it("não altera a ordem do array original", () => {
    const widgets = [text("b", 6, 0), text("a", 0, 0)]
    stackedLayout(widgets)
    expect(widgets.map((w) => w.id)).toEqual(["b", "a"])
  })
})

function sortCells(values: Cell[], kind: ColumnKind) {
  return [...values].sort((a, b) => compareCells(a, b, kind))
}

describe("ordenação de células numéricas", () => {
  it('ordena numeric/int8 em texto como número ("10" depois de "9")', () => {
    expect(sortCells(["10", "9", "100", "2"], "integer")).toEqual([
      "2",
      "9",
      "10",
      "100",
    ])
  })

  it("ordena negativos e decimais", () => {
    expect(
      sortCells(["1.5", "-2", "0", "-10.25", "1.25", "-2.5"], "decimal")
    ).toEqual(["-10.25", "-2.5", "-2", "0", "1.25", "1.5"])
    expect(sortCells([3.5, -1, 0, 10], "number")).toEqual([-1, 0, 3.5, 10])
  })

  it("mantém precisão de int8 acima de 2^53", () => {
    expect(
      sortCells(
        ["9007199254740993", "9007199254740992", "-9007199254740993"],
        "integer"
      )
    ).toEqual(["-9007199254740993", "9007199254740992", "9007199254740993"])
    expect(
      compareDecimalStrings("12345678901234567.11", "12345678901234567.1")
    ).toBeGreaterThan(0)
  })

  it("trata zeros à esquerda/direita e sinais equivalentes", () => {
    expect(compareDecimalStrings("007", "7")).toBe(0)
    expect(compareDecimalStrings("1.50", "1.5")).toBe(0)
    expect(compareDecimalStrings("-0", "0")).toBe(0)
    expect(compareDecimalStrings("+3", "3")).toBe(0)
    expect(compareDecimalStrings("abc", "1")).toBeNull()
  })

  it("nulos ficam no fim", () => {
    expect(sortCells([null, "5", null, "-1"], "integer")).toEqual([
      "-1",
      "5",
      null,
      null,
    ])
  })

  it("texto usa ordem natural do pt-BR", () => {
    expect(sortCells(["item 10", "item 9", "Ávila"], "text")).toEqual([
      "Ávila",
      "item 9",
      "item 10",
    ])
  })
})
