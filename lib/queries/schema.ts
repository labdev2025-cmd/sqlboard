import { z } from "zod"

import { paramDefinitionSchema } from "@/lib/sql-params/types"

export const tagsSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .default([])
  .transform((tags) => [...new Set(tags.map((t) => t.toLowerCase()))])

export const savedQueryInputSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome.").max(120),
  description: z.string().trim().max(2000).default(""),
  tags: tagsSchema,
  connectionId: z.uuid("Escolha uma conexão."),
  sql: z.string().min(1, "Escreva a query.").max(200_000),
  params: z.array(paramDefinitionSchema).max(100).default([]),
  cacheTtlSeconds: z.coerce.number().int().min(0).max(86_400).default(0),
})

export type SavedQueryInput = z.input<typeof savedQueryInputSchema>

export type SavedQueryView = {
  id: string
  name: string
  description: string
  tags: string[]
  connectionId: string
  connectionName: string
  sql: string
  params: z.infer<typeof paramDefinitionSchema>[]
  version: number
  cacheTtlSeconds: number
  ownerId: string
  ownerName: string
  canEdit: boolean
  createdAt: string
  updatedAt: string
}

export type SavedQueryVersionView = {
  version: number
  sql: string
  params: z.infer<typeof paramDefinitionSchema>[]
  createdAt: string
  createdByName: string | null
}
