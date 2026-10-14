import { describe, expect, it } from "vitest"

import {
  exportFileName,
  safeSpreadsheetText,
  toCsv,
  toXlsx,
} from "@/server/execution/export"

const result = {
  columns: [
    { name: "nome", kind: "text" as const, nativeType: "text" },
    { name: "valor", kind: "decimal" as const, nativeType: "numeric" },
  ],
  rows: [
    ['Ana, "A"', "10.50"],
    ['=HYPERLINK("http://x")', null],
  ],
  rowCount: 2,
  truncated: false,
  durationMs: 1,
  limit: 10,
}

describe("exportação", () => {
  it("gera CSV com BOM, aspas escapadas e fórmulas neutralizadas", () => {
    const csv = toCsv(result).toString("utf8")
    expect(csv.startsWith("﻿nome,valor\r\n")).toBe(true)
    expect(csv).toContain('"Ana, ""A""",10.50')
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")",`)
  })

  it("neutraliza fórmulas", () => {
    expect(safeSpreadsheetText("=1+1")).toBe("'=1+1")
    expect(safeSpreadsheetText("+55 85")).toBe("'+55 85")
    expect(safeSpreadsheetText("normal")).toBe("normal")
    // Numbers that arrive as strings (bigint, numeric) stay numbers…
    expect(safeSpreadsheetText("-5")).toBe("-5")
    expect(safeSpreadsheetText("-12.30")).toBe("-12.30")
    // …but anything else starting with "-" is still neutralized.
    expect(safeSpreadsheetText("-1+cmd|' /C calc'!A0")).toBe(
      "'-1+cmd|' /C calc'!A0"
    )
  })

  it("gera XLSX válido", async () => {
    const file = await toXlsx(result)
    expect(file.subarray(0, 2).toString()).toBe("PK")
  })

  it("nome de arquivo seguro", () => {
    expect(exportFileName("Vendas São Paulo/2026", "csv")).toMatch(
      /^vendas-sao-paulo-2026-\d{4}-\d{2}-\d{2}\.csv$/
    )
  })
})
