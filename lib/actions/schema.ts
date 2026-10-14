import { z } from "zod"

import { rawValueSchema } from "@/lib/queries/execute-schema"
import {
  paramDefinitionSchema,
  type ParamDefinition,
} from "@/lib/sql-params/types"

export const writeActionInputSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome.").max(120),
  description: z.string().trim().max(2000).default(""),
  connectionId: z.uuid("Escolha uma conexão de escrita."),
  sql: z.string().trim().min(1, "Escreva o comando.").max(20_000),
  params: z.array(paramDefinitionSchema).max(50).default([]),
  maxAffectedRows: z.coerce.number().int().min(1).max(10_000).default(1),
})

export type WriteActionInput = z.input<typeof writeActionInputSchema>

export const actionRunInputSchema = z.object({
  values: z.record(z.string(), rawValueSchema).default({}),
})

export const actionConfirmInputSchema = actionRunInputSchema.extend({
  /** Token returned by the preview: proves this exact run was reviewed. */
  previewToken: z
    .string({ error: "Faça a prévia antes de confirmar." })
    .min(1, "Faça a prévia antes de confirmar."),
})

export type WriteActionView = {
  id: string
  name: string
  description: string
  connectionId: string
  connectionName: string
  sql: string
  params: ParamDefinition[]
  maxAffectedRows: number
  updatedAt: string
  canManage: boolean
}

export type ActionPreview = {
  /** Statement as it will run, with placeholders (values never inlined). */
  sql: string
  values: { name: string; value: unknown }[]
  affectedRows: number
  previewToken: string
  expiresAt: string
}

export type ActionResult = {
  affectedRows: number
  durationMs: number
}
