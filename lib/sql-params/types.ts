import { z } from "zod"

export const PARAM_TYPES = [
  "text",
  "number",
  "integer",
  "date",
  "datetime",
  "boolean",
  "list",
  "multi",
] as const

export type ParamType = (typeof PARAM_TYPES)[number]

export const PARAM_TYPE_LABELS: Record<ParamType, string> = {
  text: "Texto",
  number: "Número",
  integer: "Inteiro",
  date: "Data",
  datetime: "Data e hora",
  boolean: "Sim/Não",
  list: "Lista (uma opção)",
  multi: "Lista (várias opções)",
}

export const paramOptionSchema = z.object({
  value: z.string(),
  label: z.string().optional(),
})

export const paramDefinitionSchema = z.object({
  name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  type: z.enum(PARAM_TYPES).default("text"),
  label: z.string().max(120).optional(),
  required: z.boolean().default(false),
  /** Default value as entered in the form (string, or string[] for multi). */
  default: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  /** Fixed options for list/multi. */
  options: z.array(paramOptionSchema).optional(),
  /** Options coming from another query of the same app (F4). */
  optionsQuery: z
    .object({
      queryId: z.string(),
      valueColumn: z.string(),
      labelColumn: z.string().optional(),
    })
    .optional(),
})

export type ParamDefinition = z.infer<typeof paramDefinitionSchema>
export type ParamOption = z.infer<typeof paramOptionSchema>

/** Raw values as they come from forms, URLs and bindings. */
export type RawParamValue =
  string | string[] | number | boolean | null | undefined
export type RawParamValues = Record<string, RawParamValue>
