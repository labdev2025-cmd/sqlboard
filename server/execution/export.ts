import "server-only"

import ExcelJS from "exceljs"

import type { Cell, QueryResult } from "@/lib/data-types"

/** Neutralizes spreadsheet formulas (CSV/Excel injection). */
export function safeSpreadsheetText(value: string) {
  // Plain numbers ("-5", "-12.30" from bigint/numeric) are not formulas.
  if (/^-\d+(\.\d+)?$/.test(value)) return value
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

function cellText(value: Cell): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function csvField(value: Cell) {
  const raw =
    typeof value === "string"
      ? safeSpreadsheetText(cellText(value))
      : cellText(value)
  return /[",\n\r;]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw
}

/** RFC 4180 CSV with a UTF-8 BOM (opens with accents in Excel). */
export function toCsv(result: QueryResult): Buffer {
  const lines = [
    result.columns.map((c) => csvField(c.name)).join(","),
    ...result.rows.map((row) => row.map(csvField).join(",")),
  ]
  return Buffer.from(`﻿${lines.join("\r\n")}\r\n`, "utf8")
}

export async function toXlsx(
  result: QueryResult,
  sheetName = "Resultado"
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "sqlboard"
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31) || "Resultado")
  sheet.columns = result.columns.map((c) => ({
    header: c.name,
    key: c.name,
    width: Math.min(40, Math.max(10, c.name.length + 2)),
  }))
  sheet.getRow(1).font = { bold: true }
  for (const row of result.rows) {
    sheet.addRow(
      row.map((value, i) => {
        const kind = result.columns[i]?.kind
        if (value === null || value === undefined) return null
        if (
          (kind === "integer" || kind === "decimal" || kind === "number") &&
          typeof value === "string"
        ) {
          const n = Number(value)
          // Keep the exact text when a number would lose precision.
          return Number.isFinite(n) && String(n) === value ? n : value
        }
        if (
          kind === "date" &&
          typeof value === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(value)
        ) {
          return new Date(`${value}T00:00:00Z`)
        }
        if (typeof value === "string") return safeSpreadsheetText(value)
        if (typeof value === "object") return JSON.stringify(value)
        return value
      })
    )
  }
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

export function exportFileName(base: string, format: "csv" | "xlsx") {
  const slug = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
  const stamp = new Date().toISOString().slice(0, 10)
  return `${slug || "resultado"}-${stamp}.${format}`
}

export function exportResponse(
  file: Buffer,
  format: "csv" | "xlsx",
  filename: string
) {
  return new Response(new Uint8Array(file), {
    headers: {
      "content-type":
        format === "csv"
          ? "text/csv; charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  })
}
