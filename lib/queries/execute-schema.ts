import { z } from "zod"

import { paramDefinitionSchema } from "@/lib/sql-params/types"

export const rawValueSchema = z.union([
  z.string().max(100_000),
  // Lists become one placeholder per item on most databases (SQL Server
  // accepts at most 2,100 parameters per statement).
  z.array(z.string().max(10_000)).max(1000),
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
  source: z.enum(["editor", "compare", "app"]).default("editor"),
  /** Builder preview: audit the execution under this app (edit permission checked). */
  appId: z.uuid().optional(),
  queryName: z.string().max(64).optional(),
})
