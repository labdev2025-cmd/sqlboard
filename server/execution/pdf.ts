import "server-only"

import PDFDocument from "pdfkit"

import type { QueryResult } from "@/lib/data-types"
import { formatCell } from "@/lib/format"

/** Rows beyond this go only to CSV/XLSX: a PDF report is for reading. */
export const PDF_MAX_ROWS = 1000

export type PdfSection = { title: string; result: QueryResult }

/**
 * Landscape A4 report with one titled table per section. Uses the standard
 * Helvetica font (WinAnsi), which covers Portuguese accents.
 */
export function toPdf(
  title: string,
  sections: PdfSection[],
  generatedAt = new Date()
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 36,
    info: { Title: title, Creator: "sqlboard" },
  })
  const chunks: Uint8Array[] = []
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
  })

  doc.font("Helvetica-Bold").fontSize(16).text(title)
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#555555")
    .text(
      `Gerado em ${generatedAt.toLocaleString("pt-BR", { timeZone: "UTC" })} (UTC)`
    )
    .fillColor("#000000")

  sections.forEach((section, index) => {
    if (index > 0) doc.addPage()
    const { result } = section
    const rows = result.rows.slice(0, PDF_MAX_ROWS)
    doc.moveDown()
    doc.font("Helvetica-Bold").fontSize(12).text(section.title)
    doc.font("Helvetica").fontSize(8)
    const notes = [`${result.rowCount} linha(s)`]
    if (result.truncated || result.rows.length > PDF_MAX_ROWS) {
      notes.push(
        `mostrando ${rows.length}; o resultado completo vai no CSV/XLSX`
      )
    }
    doc.fillColor("#555555").text(notes.join(" · ")).fillColor("#000000")
    doc.moveDown(0.5)
    if (!result.columns.length) return
    doc.table({
      defaultStyle: { padding: 2, fontSize: 7 } as never,
      rowStyles: (row) =>
        row === 0 ? { backgroundColor: "#eeeeee" } : undefined,
      data: [
        result.columns.map((c) => ({
          text: c.name,
          font: { src: "Helvetica-Bold" },
        })),
        ...rows.map((row) =>
          row.map((value, i) => formatCell(value, result.columns[i]!.kind))
        ),
      ],
    })
  })

  doc.end()
  return done
}
