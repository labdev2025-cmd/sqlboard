import { z } from "zod"

import { paramDefinitionSchema } from "@/lib/sql-params/types"

export const rawValueSchema = z.union([
  z.string(),
  z.array(z.string()),
  z.number(),
  z.boolean(),
  z.null(),
])

/** Ad-hoc execution from the SQL editor (editors and admins). */
export const executeInputSchema = z.object({
  connectionId: z.uuid(),
  sql: z.string().min(1).max(200_000),
  params: z.array(paramDefinitionSchema).max(100).default([]),
  values: z.record(z.string(), rawValueSchema).default({}),
  executionId: z.uuid().optional(),
  maxRows: z.number().int().min(1).max(1_000_000).optional(),
  savedQueryId: z.uuid().optional(),
  source: z.enum(["editor", "compare"]).default("editor"),
})
