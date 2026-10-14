import { z } from "zod"

/**
 * Widget registry: props schema of each widget type (PROMPT.md §5.1). The
 * `.meta()` of each field drives the generated properties panel.
 */

export type FieldControl =
  | "text"
  | "textarea"
  | "markdown"
  | "number"
  | "boolean"
  | "select"
  | "column"
  | "columns"
  | "variable"
  | "query"
  | "page"

export type FieldMeta = {
  label: string
  control: FieldControl
  description?: string
  options?: { value: string; label: string }[]
  /** Accepts `{{ }}` bindings in the panel. */
  bindable?: boolean
}

const field = <T extends z.ZodType>(schema: T, meta: FieldMeta) =>
  schema.meta(meta as never) as T

const title = field(z.string().max(200).default(""), {
  label: "Título",
  control: "text",
  bindable: true,
})
const variable = (label = "Variável") =>
  field(
    z
      .string()
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Use letras, números e _")
      .default("filtro"),
    {
      label,
      control: "variable",
      description:
        "Nome do parâmetro que este campo preenche nas queries (ex.: uf para :uf).",
    }
  )
const inputLabel = field(z.string().max(120).default(""), {
  label: "Rótulo",
  control: "text",
})

const formatOptions = [
  { value: "number", label: "Número" },
  { value: "currency", label: "Moeda (R$)" },
  { value: "percent", label: "Percentual" },
]

export const WIDGET_PROPS = {
  table: z.object({
    title,
    columns: field(z.array(z.string()).default([]), {
      label: "Colunas visíveis",
      control: "columns",
      description: "Vazio mostra todas.",
    }),
    pageSize: field(z.number().int().min(5).max(200).default(10), {
      label: "Linhas por página",
      control: "number",
    }),
    searchable: field(z.boolean().default(true), {
      label: "Busca",
      control: "boolean",
    }),
  }),
  "bar-chart": z.object({
    title,
    x: field(z.string().default(""), {
      label: "Eixo X (categoria)",
      control: "column",
    }),
    y: field(z.array(z.string()).default([]), {
      label: "Valores (eixo Y)",
      control: "columns",
    }),
    stacked: field(z.boolean().default(false), {
      label: "Empilhado",
      control: "boolean",
    }),
    horizontal: field(z.boolean().default(false), {
      label: "Barras horizontais",
      control: "boolean",
    }),
  }),
  "line-chart": z.object({
    title,
    x: field(z.string().default(""), { label: "Eixo X", control: "column" }),
    y: field(z.array(z.string()).default([]), {
      label: "Valores (eixo Y)",
      control: "columns",
    }),
  }),
  "area-chart": z.object({
    title,
    x: field(z.string().default(""), { label: "Eixo X", control: "column" }),
    y: field(z.array(z.string()).default([]), {
      label: "Valores (eixo Y)",
      control: "columns",
    }),
    stacked: field(z.boolean().default(true), {
      label: "Empilhado",
      control: "boolean",
    }),
  }),
  "pie-chart": z.object({
    title,
    label: field(z.string().default(""), {
      label: "Fatia (categoria)",
      control: "column",
    }),
    value: field(z.string().default(""), { label: "Valor", control: "column" }),
    donut: field(z.boolean().default(true), {
      label: "Rosca",
      control: "boolean",
    }),
  }),
  kpi: z.object({
    title,
    value: field(z.string().default(""), {
      label: "Coluna do valor",
      control: "column",
    }),
    compare: field(z.string().default(""), {
      label: "Coluna de comparação",
      control: "column",
      description: "Opcional: valor anterior para mostrar a variação.",
    }),
    format: field(z.enum(["number", "currency", "percent"]).default("number"), {
      label: "Formato",
      control: "select",
      options: formatOptions,
    }),
    description: field(z.string().max(300).default(""), {
      label: "Legenda",
      control: "text",
      bindable: true,
    }),
  }),
  text: z.object({
    content: field(z.string().max(20_000).default("Texto"), {
      label: "Conteúdo (Markdown)",
      control: "markdown",
      bindable: true,
    }),
  }),
  "text-input": z.object({
    label: inputLabel,
    param: variable(),
    placeholder: field(z.string().max(120).default(""), {
      label: "Dica",
      control: "text",
    }),
  }),
  "number-input": z.object({ label: inputLabel, param: variable() }),
  "date-input": z.object({ label: inputLabel, param: variable() }),
  "date-range": z.object({
    label: inputLabel,
    paramStart: variable("Variável do início"),
    paramEnd: variable("Variável do fim"),
  }),
  select: z.object({
    label: inputLabel,
    param: variable(),
    options: field(z.string().max(10_000).default(""), {
      label: "Opções fixas",
      control: "textarea",
      description: "Uma por linha: valor|rótulo. Ou use opções de uma query.",
    }),
    optionsQuery: field(z.string().default(""), {
      label: "Opções de uma query",
      control: "query",
    }),
    optionsColumn: field(z.string().default(""), {
      label: "Coluna das opções",
      control: "column",
    }),
  }),
  "multi-select": z.object({
    label: inputLabel,
    param: variable(),
    options: field(z.string().max(10_000).default(""), {
      label: "Opções fixas",
      control: "textarea",
      description: "Uma por linha: valor|rótulo. Ou use opções de uma query.",
    }),
    optionsQuery: field(z.string().default(""), {
      label: "Opções de uma query",
      control: "query",
    }),
    optionsColumn: field(z.string().default(""), {
      label: "Coluna das opções",
      control: "column",
    }),
  }),
  switch: z.object({ label: inputLabel, param: variable() }),
  button: z.object({
    label: field(z.string().max(80).default("Executar"), {
      label: "Texto do botão",
      control: "text",
    }),
    action: field(z.enum(["run", "export", "navigate"]).default("run"), {
      label: "Ação",
      control: "select",
      options: [
        { value: "run", label: "Executar query" },
        { value: "export", label: "Exportar resultado" },
        { value: "navigate", label: "Ir para página" },
      ],
    }),
    query: field(z.string().default(""), { label: "Query", control: "query" }),
    format: field(z.enum(["csv", "xlsx"]).default("csv"), {
      label: "Formato da exportação",
      control: "select",
      options: [
        { value: "csv", label: "CSV" },
        { value: "xlsx", label: "Excel (XLSX)" },
      ],
    }),
    page: field(z.string().default(""), {
      label: "Página de destino",
      control: "page",
    }),
  }),
} as const

export type WidgetType = keyof typeof WIDGET_PROPS
export const WIDGET_TYPES = Object.keys(WIDGET_PROPS) as WidgetType[]

export type WidgetCategory = "data" | "chart" | "input" | "content"

export type WidgetInfo = {
  label: string
  category: WidgetCategory
  description: string
  /** Default size in grid units (12 columns). */
  size: { w: number; h: number }
  minSize: { w: number; h: number }
  /** Uses a query result (bindings.data). */
  usesData: boolean
}

export const WIDGET_INFO: Record<WidgetType, WidgetInfo> = {
  table: {
    label: "Tabela",
    category: "data",
    description: "Linhas com busca, ordenação e paginação.",
    size: { w: 12, h: 8 },
    minSize: { w: 3, h: 4 },
    usesData: true,
  },
  "bar-chart": {
    label: "Gráfico de barras",
    category: "chart",
    description: "Compara categorias.",
    size: { w: 6, h: 8 },
    minSize: { w: 3, h: 5 },
    usesData: true,
  },
  "line-chart": {
    label: "Gráfico de linha",
    category: "chart",
    description: "Evolução ao longo do tempo.",
    size: { w: 6, h: 8 },
    minSize: { w: 3, h: 5 },
    usesData: true,
  },
  "area-chart": {
    label: "Gráfico de área",
    category: "chart",
    description: "Volume acumulado no tempo.",
    size: { w: 6, h: 8 },
    minSize: { w: 3, h: 5 },
    usesData: true,
  },
  "pie-chart": {
    label: "Pizza / rosca",
    category: "chart",
    description: "Participação de cada parte.",
    size: { w: 4, h: 8 },
    minSize: { w: 3, h: 5 },
    usesData: true,
  },
  kpi: {
    label: "KPI",
    category: "data",
    description: "Um número em destaque.",
    size: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
    usesData: true,
  },
  text: {
    label: "Texto",
    category: "content",
    description: "Markdown com valores das queries.",
    size: { w: 6, h: 3 },
    minSize: { w: 2, h: 1 },
    usesData: false,
  },
  "text-input": {
    label: "Campo de texto",
    category: "input",
    description: "Filtro de texto livre.",
    size: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
    usesData: false,
  },
  "number-input": {
    label: "Número",
    category: "input",
    description: "Filtro numérico.",
    size: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
    usesData: false,
  },
  "date-input": {
    label: "Data",
    category: "input",
    description: "Escolha de uma data.",
    size: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
    usesData: false,
  },
  "date-range": {
    label: "Intervalo de datas",
    category: "input",
    description: "Início e fim.",
    size: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
    usesData: false,
  },
  select: {
    label: "Seleção",
    category: "input",
    description: "Uma opção de uma lista.",
    size: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
    usesData: false,
  },
  "multi-select": {
    label: "Seleção múltipla",
    category: "input",
    description: "Várias opções.",
    size: { w: 4, h: 3 },
    minSize: { w: 2, h: 2 },
    usesData: false,
  },
  switch: {
    label: "Liga/desliga",
    category: "input",
    description: "Sim ou não.",
    size: { w: 2, h: 2 },
    minSize: { w: 2, h: 2 },
    usesData: false,
  },
  button: {
    label: "Botão",
    category: "content",
    description: "Executa, exporta ou navega.",
    size: { w: 2, h: 2 },
    minSize: { w: 1, h: 1 },
    usesData: false,
  },
}

export const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  data: "Dados",
  chart: "Gráficos",
  input: "Filtros",
  content: "Conteúdo",
}

export function fieldMeta(schema: z.ZodType): FieldMeta | undefined {
  return schema.meta() as FieldMeta | undefined
}

/** Ordered [key, schema, meta] list of a widget's props, for the panel. */
export function propFields(type: WidgetType) {
  const shape = WIDGET_PROPS[type].shape as Record<string, z.ZodType>
  return Object.entries(shape)
    .map(([key, schema]) => ({ key, schema, meta: fieldMeta(schema) }))
    .filter(
      (entry): entry is { key: string; schema: z.ZodType; meta: FieldMeta } =>
        Boolean(entry.meta)
    )
}

export function defaultProps<T extends WidgetType>(
  type: T
): z.infer<(typeof WIDGET_PROPS)[T]> {
  return WIDGET_PROPS[type].parse({}) as z.infer<(typeof WIDGET_PROPS)[T]>
}

/** Variables written by an input widget. */
export function widgetVariables(widget: {
  type: string
  props: Record<string, unknown>
}): string[] {
  if (widget.type === "date-range") {
    return [
      String(widget.props.paramStart ?? ""),
      String(widget.props.paramEnd ?? ""),
    ].filter(Boolean)
  }
  if (WIDGET_INFO[widget.type as WidgetType]?.category === "input") {
    return [String(widget.props.param ?? "")].filter(Boolean)
  }
  return []
}
