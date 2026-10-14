import { z } from "zod"

import { rawValueSchema } from "@/lib/queries/execute-schema"

export const SCHEDULE_FORMATS = ["csv", "xlsx", "pdf"] as const
export type ScheduleFormat = (typeof SCHEDULE_FORMATS)[number]

export const FORMAT_LABELS: Record<ScheduleFormat, string> = {
  csv: "CSV",
  xlsx: "Excel (XLSX)",
  pdf: "PDF",
}

/** Common intervals offered in the form (minutes). */
export const INTERVALS = [
  { value: 60, label: "A cada hora" },
  { value: 360, label: "A cada 6 horas" },
  { value: 1440, label: "Todo dia" },
  { value: 10080, label: "Toda semana" },
] as const

export function intervalLabel(minutes: number) {
  return (
    INTERVALS.find((i) => i.value === minutes)?.label ?? `A cada ${minutes} min`
  )
}

export const scheduleInputSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome.").max(120),
  target: z.discriminatedUnion("type", [
    z.object({ type: z.literal("query"), savedQueryId: z.uuid() }),
    z.object({ type: z.literal("app"), appId: z.uuid() }),
  ]),
  params: z.record(z.string(), rawValueSchema).default({}),
  intervalMinutes: z.coerce
    .number()
    .int()
    .min(15, "O intervalo mínimo é de 15 minutos.")
    .max(43_200),
  recipients: z
    .array(z.email("E-mail inválido."))
    .min(1, "Informe ao menos um destinatário.")
    .max(20, "No máximo 20 destinatários."),
  format: z.enum(SCHEDULE_FORMATS).default("csv"),
  enabled: z.boolean().default(true),
})

export type ScheduleInput = z.input<typeof scheduleInputSchema>

export type ScheduleView = {
  id: string
  name: string
  ownerId: string
  ownerName: string
  target:
    | { type: "query"; savedQueryId: string; name: string }
    | { type: "app"; appId: string; name: string }
  params: Record<string, unknown>
  intervalMinutes: number
  recipients: string[]
  format: ScheduleFormat
  enabled: boolean
  nextRunAt: string
  lastRunAt: string | null
  lastStatus: string | null
  lastError: string | null
  canEdit: boolean
}

/** Parses "a@x.com, b@y.com; c@z.com" (one per line also works). */
export function parseRecipients(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ]
}
