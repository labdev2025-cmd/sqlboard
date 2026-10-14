import "server-only"

import { z } from "zod"

import { and, desc, eq, inArray, lte, sql as dsql } from "drizzle-orm"

import { isRole } from "@/lib/auth/roles"
import {
  scheduleInputSchema,
  type ScheduleFormat,
  type ScheduleView,
} from "@/lib/schedules/schema"
import type { RawParamValues } from "@/lib/sql-params"
import type { CurrentUser } from "@/server/auth/session"
import { db } from "@/server/db/client"
import {
  apps,
  savedQueries,
  schedules,
  user as userTable,
} from "@/server/db/schema"
import { executeQuery } from "@/server/execution/execute"
import { exportFileName, toCsv, toXlsx } from "@/server/execution/export"
import { toPdf, type PdfSection } from "@/server/execution/pdf"
import { badRequest, forbidden, HttpError, notFound } from "@/server/http"
import {
  allowedDomains,
  recipientAllowed,
  sendMail,
  type MailAttachment,
  type MailResult,
} from "@/server/mail/mailer"

import { getRunnableDocument } from "./apps"
import { getConnectionRow, getUsableConnection } from "./connections"
import { getSavedQuery } from "./queries"

type ScheduleRow = typeof schedules.$inferSelect

function assertEditor(user: CurrentUser) {
  if (user.role === "viewer")
    throw forbidden("Leitores não criam agendamentos.")
}

function canEdit(user: CurrentUser, row: ScheduleRow) {
  return user.role === "admin" || row.ownerId === user.id
}

async function toViews(
  user: CurrentUser,
  rows: ScheduleRow[]
): Promise<ScheduleView[]> {
  const ownerIds = [...new Set(rows.map((r) => r.ownerId))]
  const queryIds = rows.flatMap((r) => (r.savedQueryId ? [r.savedQueryId] : []))
  const appIds = rows.flatMap((r) => (r.appId ? [r.appId] : []))
  const [owners, queries, appRows] = await Promise.all([
    ownerIds.length
      ? db
          .select({ id: userTable.id, name: userTable.name })
          .from(userTable)
          .where(inArray(userTable.id, ownerIds))
      : [],
    queryIds.length
      ? db
          .select({ id: savedQueries.id, name: savedQueries.name })
          .from(savedQueries)
          .where(inArray(savedQueries.id, queryIds))
      : [],
    appIds.length
      ? db
          .select({ id: apps.id, name: apps.name })
          .from(apps)
          .where(inArray(apps.id, appIds))
      : [],
  ])
  const names = new Map(
    [...owners, ...queries, ...appRows].map((r) => [r.id, r.name])
  )
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    ownerId: row.ownerId,
    ownerName: names.get(row.ownerId) ?? "",
    target: row.savedQueryId
      ? {
          type: "query",
          savedQueryId: row.savedQueryId,
          name: names.get(row.savedQueryId) ?? "",
        }
      : { type: "app", appId: row.appId!, name: names.get(row.appId!) ?? "" },
    params: (row.params ?? {}) as Record<string, unknown>,
    intervalMinutes: row.intervalMinutes,
    recipients: row.recipients,
    format: row.format as ScheduleFormat,
    enabled: row.enabled,
    nextRunAt: row.nextRunAt.toISOString(),
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    lastStatus: row.lastStatus,
    lastError: row.lastError,
    canEdit: canEdit(user, row),
  }))
}

/** Admins see every schedule; editors see their own. */
export async function listSchedules(user: CurrentUser) {
  assertEditor(user)
  const rows = await db
    .select()
    .from(schedules)
    .where(user.role === "admin" ? undefined : eq(schedules.ownerId, user.id))
    .orderBy(desc(schedules.createdAt))
  return toViews(user, rows)
}

async function loadEditable(user: CurrentUser, id: string) {
  assertEditor(user)
  if (!z.uuid().safeParse(id).success)
    throw notFound("Agendamento não encontrado.")
  const [row] = await db.select().from(schedules).where(eq(schedules.id, id))
  if (!row || !canEdit(user, row)) throw notFound("Agendamento não encontrado.")
  return row
}

/** Validates the input and that the user can run the target right now. */
async function parseInput(user: CurrentUser, raw: unknown) {
  const input = scheduleInputSchema.parse(raw)
  const domains = allowedDomains()
  const refused = input.recipients.filter((r) => !recipientAllowed(r, domains))
  if (refused.length) {
    throw badRequest(
      `Destinatários fora dos domínios permitidos (${domains.join(", ")}): ${refused.join(", ")}.`
    )
  }
  if (input.target.type === "query") {
    await getSavedQuery(user, input.target.savedQueryId)
  } else {
    await getRunnableDocument(user, input.target.appId, "published")
  }
  return {
    name: input.name,
    savedQueryId:
      input.target.type === "query" ? input.target.savedQueryId : null,
    appId: input.target.type === "app" ? input.target.appId : null,
    params: input.params,
    intervalMinutes: input.intervalMinutes,
    recipients: input.recipients.map((r) => r.toLowerCase()),
    format: input.format,
    enabled: input.enabled,
  }
}

const nextRun = (minutes: number, from = new Date()) =>
  new Date(from.getTime() + minutes * 60_000)

export async function createSchedule(user: CurrentUser, raw: unknown) {
  assertEditor(user)
  const values = await parseInput(user, raw)
  const [row] = await db
    .insert(schedules)
    .values({
      ...values,
      ownerId: user.id,
      nextRunAt: nextRun(values.intervalMinutes),
    })
    .returning()
  return (await toViews(user, [row!]))[0]!
}

export async function updateSchedule(
  user: CurrentUser,
  id: string,
  raw: unknown
) {
  const current = await loadEditable(user, id)
  const values = await parseInput(user, raw)
  const [row] = await db
    .update(schedules)
    .set({
      ...values,
      nextRunAt:
        values.intervalMinutes !== current.intervalMinutes ||
        (values.enabled && !current.enabled)
          ? nextRun(values.intervalMinutes)
          : current.nextRunAt,
      updatedAt: new Date(),
    })
    .where(eq(schedules.id, id))
    .returning()
  return (await toViews(user, [row!]))[0]!
}

export async function deleteSchedule(user: CurrentUser, id: string) {
  await loadEditable(user, id)
  await db.delete(schedules).where(eq(schedules.id, id))
}

/** Runs now (button in the UI) without changing the regular cadence. */
export async function runScheduleNow(user: CurrentUser, id: string) {
  const row = await loadEditable(user, id)
  return runSchedule(row)
}

/* ------------------------------------------------------------------ */
/* Execution                                                           */
/* ------------------------------------------------------------------ */

/** The owner as they are now: deactivated or demoted owners stop the run. */
async function loadOwner(ownerId: string): Promise<CurrentUser> {
  const [row] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, ownerId))
  if (!row || row.disabled || !isRole(row.role)) {
    throw forbidden("O dono do agendamento está desativado.")
  }
  if (row.role === "viewer") {
    throw forbidden("O dono do agendamento não é mais editor.")
  }
  return { id: row.id, name: row.name, email: row.email, role: row.role }
}

type Section = PdfSection & { fileBase: string }

/**
 * Collects the data with the owner's current permissions: the same checks
 * as the API (query visibility, connection access, published screen).
 */
async function collect(row: ScheduleRow, owner: CurrentUser) {
  const values = (row.params ?? {}) as RawParamValues
  const sections: Section[] = []
  const skipped: string[] = []
  if (row.savedQueryId) {
    const query = await getSavedQuery(owner, row.savedQueryId)
    const connection = await getUsableConnection(owner, query.connectionId)
    const result = await executeQuery({
      user: owner,
      connection,
      sql: query.sql,
      params: query.params,
      values,
      source: "schedule",
      savedQueryId: query.id,
      queryName: query.name,
    })
    sections.push({ title: query.name, result, fileBase: query.name })
    return {
      title: query.name,
      link: `/queries/${query.id}`,
      sections,
      skipped,
    }
  }
  const { app, document } = await getRunnableDocument(
    owner,
    row.appId!,
    "published"
  )
  for (const query of document.queries) {
    const connection = await getConnectionRow(query.connectionId)
    try {
      const result = await executeQuery({
        user: owner,
        connection,
        sql: query.sql,
        params: query.params,
        values,
        source: "schedule",
        appId: app.id,
        queryName: query.name,
      })
      sections.push({
        title: query.name,
        result,
        fileBase: `${app.name}-${query.name}`,
      })
    } catch (error) {
      // Queries fed by a click or an empty input cannot run unattended.
      if (error instanceof HttpError && error.status === 400) {
        skipped.push(`${query.name}: ${error.message}`)
        continue
      }
      throw error
    }
  }
  if (!sections.length) {
    throw badRequest(
      "Nenhuma query da tela pôde rodar sem interação. " + skipped.join(" ")
    )
  }
  return { title: app.name, link: `/apps/${app.id}`, sections, skipped }
}

async function attachmentsFor(
  title: string,
  sections: Section[],
  format: ScheduleFormat
): Promise<MailAttachment[]> {
  if (format === "pdf") {
    return [
      {
        filename: exportFileName(title, "csv").replace(/\.csv$/, ".pdf"),
        content: await toPdf(title, sections),
        contentType: "application/pdf",
      },
    ]
  }
  return Promise.all(
    sections.map(async (s) => ({
      filename: exportFileName(s.fileBase, format),
      content:
        format === "csv" ? toCsv(s.result) : await toXlsx(s.result, s.title),
      contentType:
        format === "csv"
          ? "text/csv; charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }))
  )
}

export type ScheduleRunResult = {
  status: "ok" | "error"
  error?: string
  mail?: MailResult
}

/** Runs one schedule, mails the result and records the outcome. */
export async function runSchedule(
  row: ScheduleRow
): Promise<ScheduleRunResult> {
  let outcome: ScheduleRunResult
  try {
    const owner = await loadOwner(row.ownerId)
    // Rechecked on every run: tightening the allowed domains also stops
    // schedules created before the change.
    const domains = allowedDomains()
    const refused = row.recipients.filter((r) => !recipientAllowed(r, domains))
    if (refused.length) {
      throw badRequest(
        `Destinatários fora dos domínios permitidos: ${refused.join(", ")}.`
      )
    }
    const { title, link, sections, skipped } = await collect(row, owner)
    const format = row.format as ScheduleFormat
    const base = process.env.BETTER_AUTH_URL ?? ""
    const lines = [
      `Agendamento “${row.name}”: ${title}.`,
      "",
      ...sections.map(
        (s) =>
          `• ${s.title}: ${s.result.rowCount} linha(s)${s.result.truncated ? " (limitado pelo máximo da conexão)" : ""}`
      ),
      ...(skipped.length
        ? ["", "Não incluídas (precisam de interação na tela):", ...skipped]
        : []),
      "",
      base ? `Abrir no sqlboard: ${base}${link}` : "",
      "Enviado automaticamente pelo sqlboard.",
    ]
    const mail = await sendMail({
      to: row.recipients,
      subject: `[sqlboard] ${row.name}`,
      text: lines.join("\n"),
      attachments: await attachmentsFor(title, sections, format),
    })
    outcome = { status: "ok", mail }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha desconhecida."
    outcome = { status: "error", error: message }
  }
  await db
    .update(schedules)
    .set({
      lastRunAt: new Date(),
      lastStatus: outcome.status,
      lastError: outcome.error ?? null,
    })
    .where(eq(schedules.id, row.id))
  return outcome
}

/**
 * Claims due schedules atomically (FOR UPDATE SKIP LOCKED) and advances
 * their next run before executing, so several replicas never run the same
 * schedule twice.
 */
export async function runDueSchedules(now = new Date(), limit = 5) {
  const claimed = await db.transaction(async (tx) => {
    const due = await tx
      .select({ id: schedules.id })
      .from(schedules)
      .where(and(eq(schedules.enabled, true), lte(schedules.nextRunAt, now)))
      .orderBy(schedules.nextRunAt)
      .limit(limit)
      .for("update", { skipLocked: true })
    if (!due.length) return []
    return tx
      .update(schedules)
      .set({
        nextRunAt: dsql`${now.toISOString()}::timestamptz + make_interval(mins => ${schedules.intervalMinutes})`,
      })
      .where(
        inArray(
          schedules.id,
          due.map((d) => d.id)
        )
      )
      .returning()
  })
  const results: (ScheduleRunResult & { id: string })[] = []
  for (const row of claimed) {
    results.push({ id: row.id, ...(await runSchedule(row)) })
  }
  return results
}

declare global {
  var __sqlboardScheduler: NodeJS.Timeout | undefined
}

/** In-process scheduler (SQLBOARD_SCHEDULER=off disables it). */
export function startScheduler(intervalMs = 30_000) {
  if (process.env.SQLBOARD_SCHEDULER === "off") return
  if (globalThis.__sqlboardScheduler) return
  let busy = false
  const tick = async () => {
    if (busy) return
    busy = true
    try {
      await runDueSchedules()
    } catch (error) {
      console.error("[scheduler]", error)
    } finally {
      busy = false
    }
  }
  globalThis.__sqlboardScheduler = setInterval(() => void tick(), intervalMs)
  globalThis.__sqlboardScheduler.unref()
  console.log("[sqlboard] agendador ligado")
}
