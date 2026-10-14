import { mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { eq } from "drizzle-orm"
import { simpleParser } from "mailparser"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { newDocument } from "@/lib/app-schema"
import { defaultProps } from "@/lib/widgets/registry"
import { db } from "@/server/db/client"
import { schedules, user as userTable } from "@/server/db/schema"
import { HttpError } from "@/server/http"
import { createApp, publishApp, saveDraft } from "@/server/services/apps"
import { createConnection, setAccess } from "@/server/services/connections"
import { createSavedQuery } from "@/server/services/queries"
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  runDueSchedules,
  runScheduleNow,
  updateSchedule,
} from "@/server/services/schedules"
import { toPdf } from "@/server/execution/pdf"

import { demoConnectionInput, makeUser } from "../support/fixtures"

type User = Awaited<ReturnType<typeof makeUser>>
let admin: User, editor: User, other: User, viewer: User
let connectionId: string
let queryId: string
let appId: string
let outbox: string

const status = (promise: Promise<unknown>) =>
  promise.then(
    () => 200,
    (error) =>
      error instanceof HttpError ? error.status : (console.error(error), 500)
  )

async function lastMail() {
  const files = (await readdir(outbox)).sort()
  return simpleParser(await readFile(path.join(outbox, files.at(-1)!)))
}

beforeAll(async () => {
  outbox = await mkdtemp(path.join(tmpdir(), "sqlboard-outbox-"))
  process.env.SQLBOARD_OUTBOX_DIR = outbox
  delete process.env.SMTP_URL
  admin = await makeUser("admin")
  editor = await makeUser("editor")
  other = await makeUser("editor")
  viewer = await makeUser("viewer")
  connectionId = (
    await createConnection(admin, {
      ...demoConnectionInput,
      name: `Agenda ${Date.now()}`,
    })
  ).id
  await setAccess(admin, connectionId, [editor.id])
  queryId = (
    await createSavedQuery(editor, {
      name: "Pedidos por status",
      connectionId,
      sql: "select status, count(*) as pedidos from loja.pedidos where status <> :ignorar group by status order by status",
      params: [{ name: "ignorar", type: "text", required: true }],
    })
  ).id
  appId = (await createApp(editor, { name: "Painel agendado" })).id
  const doc = newDocument({ id: appId, name: "Painel agendado" })
  doc.queries.push(
    {
      id: "q1",
      name: "estados",
      connectionId,
      sql: "select uf, count(*) as total from loja.clientes group by uf order by uf",
      params: [],
      runMode: "auto",
      sourceQueryId: null,
      cacheTtlSeconds: 0,
      paramBindings: {},
    },
    {
      id: "q2",
      name: "detalhe",
      connectionId,
      sql: "select nome from loja.clientes where uf = :uf",
      params: [{ name: "uf", type: "text", required: true }],
      runMode: "auto",
      sourceQueryId: null,
      cacheTtlSeconds: 0,
      paramBindings: {},
    }
  )
  doc.pages[0]!.widgets.push({
    id: "tabela1",
    type: "table",
    grid: { x: 0, y: 0, w: 12, h: 6 },
    props: defaultProps("table"),
    bindings: { data: "{{estados.data}}" },
  })
  await saveDraft(editor, appId, doc)
  await publishApp(editor, appId)
})

afterAll(async () => {
  await rm(outbox, { recursive: true, force: true })
})

describe("agendamentos", () => {
  it("valida entrada e permissões ao criar", async () => {
    const base = {
      name: "Diário",
      target: { type: "query", savedQueryId: queryId },
      params: { ignorar: "cancelado" },
      intervalMinutes: 1440,
      recipients: ["equipe@exemplo.test"],
      format: "csv",
    }
    expect(await status(createSchedule(viewer, base))).toBe(403)
    // Other editor has no access to the connection: the query is hidden.
    expect(await status(createSchedule(other, base))).toBe(404)
    await expect(
      createSchedule(editor, { ...base, intervalMinutes: 5 })
    ).rejects.toThrow()
    await expect(
      createSchedule(editor, { ...base, recipients: ["não-é-email"] })
    ).rejects.toThrow()
    process.env.SQLBOARD_MAIL_ALLOWED_DOMAINS = "empresa.test"
    expect(await status(createSchedule(editor, base))).toBe(400)
    delete process.env.SQLBOARD_MAIL_ALLOWED_DOMAINS
  })

  it("executa a query e envia CSV para a caixa de saída", async () => {
    const schedule = await createSchedule(editor, {
      name: "Pedidos diário",
      target: { type: "query", savedQueryId: queryId },
      params: { ignorar: "cancelado" },
      intervalMinutes: 1440,
      recipients: ["Equipe@Exemplo.test"],
      format: "csv",
    })
    expect(schedule.recipients).toEqual(["equipe@exemplo.test"])
    expect(schedule.target).toMatchObject({ name: "Pedidos por status" })
    // Not due yet: the scheduler leaves it alone.
    expect((await runDueSchedules()).some((r) => r.id === schedule.id)).toBe(
      false
    )

    const outcome = await runScheduleNow(editor, schedule.id)
    expect(outcome).toMatchObject({ status: "ok" })
    const mail = await lastMail()
    expect(mail.subject).toBe("[sqlboard] Pedidos diário")
    expect(mail.to).toMatchObject({ text: "equipe@exemplo.test" })
    expect(mail.attachments).toHaveLength(1)
    const [file] = mail.attachments
    expect(file!.filename).toMatch(/^pedidos-por-status-.*\.csv$/)
    // Bound parameter: "cancelado" does not appear among the statuses.
    const csv = file!.content.toString("utf8")
    expect(csv).toContain("status,pedidos")
    expect(csv).not.toContain("cancelado")

    // Allowed domains tightened later: the existing schedule stops sending.
    process.env.SQLBOARD_MAIL_ALLOWED_DOMAINS = "empresa.test"
    const blocked = await runScheduleNow(editor, schedule.id)
    expect(blocked.status).toBe("error")
    expect(blocked.error).toMatch(/domínios permitidos/)
    delete process.env.SQLBOARD_MAIL_ALLOWED_DOMAINS

    // Others cannot see, run or delete it.
    expect(await status(runScheduleNow(other, schedule.id))).toBe(404)
    expect((await listSchedules(other)).map((s) => s.id)).not.toContain(
      schedule.id
    )
    expect((await listSchedules(admin)).map((s) => s.id)).toContain(schedule.id)
  })

  it("roda os vencidos uma única vez e avança a próxima execução", async () => {
    const schedule = await createSchedule(editor, {
      name: "Painel em PDF",
      target: { type: "app", appId },
      intervalMinutes: 60,
      recipients: ["diretoria@exemplo.test"],
      format: "pdf",
    })
    await db
      .update(schedules)
      .set({ nextRunAt: new Date(Date.now() - 60_000) })
      .where(eq(schedules.id, schedule.id))
    const [first, second] = await Promise.all([
      runDueSchedules(),
      runDueSchedules(),
    ])
    const runs = [...first!, ...second!].filter((r) => r.id === schedule.id)
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ status: "ok" })
    const [row] = await db
      .select()
      .from(schedules)
      .where(eq(schedules.id, schedule.id))
    expect(row!.nextRunAt.getTime()).toBeGreaterThan(Date.now() + 50 * 60_000)
    expect(row!.lastStatus).toBe("ok")
    const mail = await lastMail()
    expect(mail.attachments.map((a) => a.contentType)).toEqual([
      "application/pdf",
    ])
    // The click-driven query cannot run unattended and is reported.
    expect(mail.text).toContain("Não incluídas")
    expect(mail.text).toContain("detalhe")
    expect(mail.text).toMatch(/estados: \d+ linha/)
  })

  it("para quando o dono perde o acesso ou é desativado", async () => {
    const schedule = await createSchedule(editor, {
      name: "Sem acesso depois",
      target: { type: "query", savedQueryId: queryId },
      params: { ignorar: "x" },
      intervalMinutes: 60,
      recipients: ["equipe@exemplo.test"],
    })
    await setAccess(admin, connectionId, [])
    const outcome = await runScheduleNow(admin, schedule.id)
    expect(outcome.status).toBe("error")
    expect(outcome.error).toMatch(/não encontrada/i)
    await setAccess(admin, connectionId, [editor.id])

    await db
      .update(userTable)
      .set({ disabled: true })
      .where(eq(userTable.id, editor.id))
    expect((await runScheduleNow(admin, schedule.id)).error).toMatch(
      /desativado/
    )
    await db
      .update(userTable)
      .set({ disabled: false })
      .where(eq(userTable.id, editor.id))

    const updated = await updateSchedule(editor, schedule.id, {
      name: "Renomeado",
      target: { type: "query", savedQueryId: queryId },
      params: { ignorar: "x" },
      intervalMinutes: 60,
      recipients: ["equipe@exemplo.test"],
      enabled: false,
    })
    expect(updated).toMatchObject({ name: "Renomeado", enabled: false })
    await deleteSchedule(editor, schedule.id)
    expect(await status(deleteSchedule(editor, schedule.id))).toBe(404)
    expect(await status(deleteSchedule(editor, "não-é-uuid"))).toBe(404)
  })

  it("gera PDF com acentos e várias seções", async () => {
    const pdf = await toPdf("Relatório de ações", [
      {
        title: "Seção um",
        result: {
          columns: [{ name: "cidade", kind: "text", nativeType: "text" }],
          rows: [["São Paulo"], ["Ceará"]],
          rowCount: 2,
          truncated: false,
          durationMs: 1,
          limit: 10,
        },
      },
      {
        title: "Seção vazia",
        result: {
          columns: [],
          rows: [],
          rowCount: 0,
          truncated: false,
          durationMs: 1,
          limit: 10,
        },
      },
    ])
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
    expect(pdf.length).toBeGreaterThan(1000)
  })
})
