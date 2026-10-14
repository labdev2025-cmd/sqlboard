/**
 * "Gerar tela com IA" (F6): prompt to build or change a screen from a
 * description, and validation of the JSON the AI answers. Pure module, used
 * by the builder (copy and paste) and by the MCP server (agents).
 * It never receives result rows, credentials, host or connection name.
 */
import { z } from "zod"

import {
  appDocumentSchema,
  CURRENT_SCHEMA_VERSION,
  migrateDocument,
  type AppDocument,
} from "@/lib/app-schema"
import type { SchemaTable } from "@/lib/data-types"
import type { SqlDialect } from "@/lib/sql-params"
import {
  propFields,
  WIDGET_INFO,
  type WidgetType,
} from "@/lib/widgets/registry"

import { describeTable, DIALECT_NAMES } from "./index"

/** JSON Schema of the screen document (input shape: defaults optional). */
export function documentJsonSchema() {
  return z.toJSONSchema(appDocumentSchema, {
    io: "input",
    unrepresentable: "any",
  })
}

/** One line per widget type with its props, from the registry metadata. */
export function widgetCatalog(): string {
  return (Object.keys(WIDGET_INFO) as WidgetType[])
    .map((type) => {
      const info = WIDGET_INFO[type]
      const props = propFields(type)
        .map(({ key, meta }) => (meta.label ? `${key} (${meta.label})` : key))
        .join(", ")
      return `- ${type}: ${info.label} — ${info.description} Tamanho padrão ${info.size.w}×${info.size.h}. Props: ${props}.${info.usesData ? ' Usa bindings.data = "{{query.data}}".' : ""}`
    })
    .join("\n")
}

export const SCREEN_RULES = [
  "Regras do documento:",
  `- schemaVersion = ${CURRENT_SCHEMA_VERSION}; mantenha app.id e use o connectionId informado em todas as queries.`,
  "- Nomes de queries e ids de componentes são identificadores (letras, números e _), únicos na tela.",
  "- SQL: um único SELECT/WITH somente leitura por query, no dialeto informado.",
  "- Parâmetros entram como :nome no SQL e são declarados em params (type: text, number, integer, date, datetime, boolean, list ou multi). Nunca coloque valores digitados pelo usuário dentro do SQL.",
  "- Trechos opcionais ficam entre [[ ... ]] e somem quando o parâmetro está vazio.",
  '- Um componente de entrada (text-input, select, date-input…) com props.param = "nome" alimenta o parâmetro :nome de mesmo nome.',
  '- Componentes de dados recebem bindings.data = "{{nomeDaQuery.data}}"; textos e títulos podem usar {{componente.selectedRow.coluna}}.',
  "- Grade de 12 colunas: grid = { x, y, w, h } com x + w ≤ 12, sem sobreposição na mesma página.",
]

export function buildScreenPrompt(options: {
  request: string
  dialect: SqlDialect
  connectionId: string
  serverVersion?: string
  tables: SchemaTable[]
  current: AppDocument
}): string {
  const dialect = DIALECT_NAMES[options.dialect]
  return [
    "Você é especialista em SQL e em painéis de dados.",
    `Monte (ou altere) a tela do sqlboard descrita abaixo, com queries ${dialect}.`,
    "Responda SOMENTE com o documento JSON completo da tela num bloco ```json```, sem explicações.",
    "",
    "## Pedido",
    options.request.trim(),
    "",
    SCREEN_RULES.join("\n"),
    "",
    `connectionId a usar: ${options.connectionId}`,
    options.serverVersion ? `Banco: ${options.serverVersion}` : "",
    "",
    "## Componentes disponíveis",
    widgetCatalog(),
    "",
    "## Tabelas e views",
    options.tables.length
      ? options.tables.map(describeTable).join("\n\n")
      : "(sem schema carregado)",
    "",
    "## Documento atual",
    "```json",
    JSON.stringify(options.current, null, 2),
    "```",
    "",
    "## JSON Schema do documento",
    "```json",
    JSON.stringify(documentJsonSchema()),
    "```",
  ]
    .filter((line) => line !== null)
    .join("\n")
}

export class ScreenAnswerError extends Error {
  constructor(
    message: string,
    public issues: { path: string; message: string }[] = []
  ) {
    super(message)
  }
}

/** Extracts the JSON document from the answer and validates it. */
export function parseScreenAnswer(
  text: string,
  expected: { appId: string }
): AppDocument {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const body = (fenced ? fenced[1]! : text).trim()
  let raw: unknown
  try {
    raw = JSON.parse(body)
  } catch {
    throw new ScreenAnswerError(
      "A resposta não contém um JSON válido. Peça para a IA responder só com o bloco ```json```."
    )
  }
  let document: AppDocument
  try {
    document = migrateDocument(raw)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ScreenAnswerError(
        "O documento não segue o formato da tela.",
        error.issues.slice(0, 20).map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        }))
      )
    }
    throw new ScreenAnswerError((error as Error).message)
  }
  // The screen keeps its identity whatever the AI wrote.
  document.app.id = expected.appId
  return document
}
