import { execFileSync } from "node:child_process"
import path from "node:path"

import { and, desc, eq } from "drizzle-orm"
import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { compileSql } from "@/lib/sql-params"
import { db } from "@/server/db/client"
import { queryExecutions } from "@/server/db/schema"
import { closeAllAdapters } from "@/server/datasources/registry"
import { SqliteAdapter } from "@/server/datasources/sqlite"
import { HttpError } from "@/server/http"
import {
  createConnection,
  setAccess,
  updateConnection,
} from "@/server/services/connections"
import {
  createAction,
  deleteAction,
  listActions,
  previewAction,
  runAction,
  updateAction,
} from "@/server/services/write-actions"
import { executeQuery } from "@/server/execution/execute"

import { demoConnectionInput, makeUser } from "../support/fixtures"
import { TEST_ENV } from "../support/test-env"

type User = Awaited<ReturnType<typeof makeUser>>
let admin: User, operator: User, outsider: User
let writeConnectionId: string
let readConnectionId: string
let insertId: string
let updateId: string
let demo: Client

const status = (promise: Promise<unknown>) =>
  promise.then(
    () => 200,
    (error) =>
      error instanceof HttpError ? error.status : (console.error(error), 500)
  )

const writeInput = {
  ...demoConnectionInput,
  username: TEST_ENV.DEMO_DB_WRITE_USER,
  password: TEST_ENV.DEMO_DB_WRITE_PASSWORD,
  purpose: "write" as const,
}

async function countRequests(subject: string) {
  const { rows } = await demo.query<{ n: string }>(
    "select count(*) as n from loja.solicitacoes where assunto = $1",
    [subject]
  )
  return Number(rows[0]!.n)
}

beforeAll(async () => {
  demo = new Client({
    host: TEST_ENV.DEMO_DB_HOST,
    port: Number(TEST_ENV.DEMO_DB_PORT),
    database: TEST_ENV.DEMO_DB_NAME,
    user: TEST_ENV.DEMO_DB_WRITE_USER,
    password: TEST_ENV.DEMO_DB_WRITE_PASSWORD,
  })
  await demo.connect()
  admin = await makeUser("admin")
  operator = await makeUser("editor")
  outsider = await makeUser("editor")
  writeConnectionId = (
    await createConnection(admin, {
      ...writeInput,
      name: `Escrita ${Date.now()}`,
    })
  ).id
  readConnectionId = (
    await createConnection(admin, {
      ...demoConnectionInput,
      name: `Leitura ${Date.now()}`,
    })
  ).id
  await setAccess(admin, writeConnectionId, [operator.id])
})

afterAll(async () => {
  await demo.end()
  await closeAllAdapters()
})

describe("cadastro de ações", () => {
  it("só admin cadastra, só INSERT/UPDATE e só em conexão de escrita", async () => {
    const base = {
      name: `Abrir solicitação ${Date.now()}`,
      connectionId: writeConnectionId,
      sql: "insert into loja.solicitacoes (cliente_id, assunto) values (:cliente_id, :assunto)",
    }
    expect(await status(createAction(operator, base))).toBe(403)
    expect(
      await status(
        createAction(admin, { ...base, connectionId: readConnectionId })
      )
    ).toBe(400)
    expect(
      await status(
        createAction(admin, { ...base, sql: "delete from loja.solicitacoes" })
      )
    ).toBe(400)
    expect(
      await status(
        createAction(admin, {
          ...base,
          sql: "update loja.solicitacoes set status = 'resolvida'",
        })
      )
    ).toBe(400)
    const created = await createAction(admin, base)
    insertId = created.id
    // Parameters come from the SQL, with inferred types.
    expect(created.params.map((p) => [p.name, p.type])).toEqual([
      ["cliente_id", "integer"],
      ["assunto", "text"],
    ])
    updateId = (
      await createAction(admin, {
        name: `Mudar status ${Date.now()}`,
        connectionId: writeConnectionId,
        sql: "update loja.solicitacoes set status = :status where assunto = :assunto",
        params: [
          { name: "status", type: "text", required: true },
          { name: "assunto", type: "text", required: true },
        ],
        maxAffectedRows: 2,
      })
    ).id
  })

  it("lista só para quem tem acesso à conexão de escrita", async () => {
    expect((await listActions(operator)).map((a) => a.id)).toContain(insertId)
    expect(await listActions(outsider)).toEqual([])
    expect(await status(previewAction(outsider, insertId, {}))).toBe(404)
  })
})

describe("prévia, confirmação e gravação", () => {
  it("a prévia não grava; a confirmação grava exatamente o revisado", async () => {
    const subject = `Troca de endereço ${Date.now()}`
    const values = { cliente_id: "3", assunto: subject }
    const preview = await previewAction(operator, insertId, { values })
    expect(preview.affectedRows).toBe(1)
    expect(preview.sql).toContain("$1")
    expect(preview.sql).not.toContain(subject)
    expect(await countRequests(subject)).toBe(0)

    // Changing the values after the preview is refused.
    expect(
      await status(
        runAction(operator, insertId, {
          values: { ...values, assunto: "outro" },
          previewToken: preview.previewToken,
        })
      )
    ).toBe(400)
    // No preview token: rejected by validation (400 through the API).
    await expect(runAction(operator, insertId, { values })).rejects.toThrow(
      /Faça a prévia/
    )
    // Another user cannot reuse the preview.
    await setAccess(admin, writeConnectionId, [operator.id, outsider.id])
    expect(
      await status(
        runAction(outsider, insertId, {
          values,
          previewToken: preview.previewToken,
        })
      )
    ).toBe(400)
    await setAccess(admin, writeConnectionId, [operator.id])

    const result = await runAction(operator, insertId, {
      values,
      previewToken: preview.previewToken,
    })
    expect(result.affectedRows).toBe(1)
    expect(await countRequests(subject)).toBe(1)
    // A preview confirms one run only.
    expect(
      await status(
        runAction(operator, insertId, {
          values,
          previewToken: preview.previewToken,
        })
      )
    ).toBe(400)
    expect(await countRequests(subject)).toBe(1)

    const [entry] = await db
      .select()
      .from(queryExecutions)
      .where(
        and(
          eq(queryExecutions.userId, operator.id),
          eq(queryExecutions.source, "action")
        )
      )
      .orderBy(desc(queryExecutions.createdAt))
      .limit(1)
    expect(entry).toMatchObject({ status: "ok", rowCount: 1 })
    expect(entry!.params).toMatchObject({ assunto: subject, cliente_id: 3 })
  })

  it("valores maliciosos são só valores (bind)", async () => {
    const subject = `x${Date.now()}'); delete from loja.solicitacoes; --`
    const values = { cliente_id: "4", assunto: subject }
    const preview = await previewAction(operator, insertId, { values })
    await runAction(operator, insertId, {
      values,
      previewToken: preview.previewToken,
    })
    expect(await countRequests(subject)).toBe(1)
    expect(
      await countRequests("Dúvida sobre entrega do pedido")
    ).toBeGreaterThan(0)
  })

  it("desfaz quando afetaria linhas demais", async () => {
    // The seed has many "Dúvida…" rows; the action allows at most 2.
    const values = {
      status: "resolvida",
      assunto: "Dúvida sobre entrega do pedido",
    }
    const before = await demo.query(
      "select count(*) from loja.solicitacoes where status = 'resolvida'"
    )
    const response = previewAction(operator, updateId, { values })
    expect(await status(response)).toBe(422)
    await expect(previewAction(operator, updateId, { values })).rejects.toThrow(
      /acima do limite de 2/
    )
    const after = await demo.query(
      "select count(*) from loja.solicitacoes where status = 'resolvida'"
    )
    expect(after.rows[0]).toEqual(before.rows[0])
  })

  it("respeita as permissões do usuário do banco e valida tipos", async () => {
    expect(
      await status(
        previewAction(operator, insertId, {
          values: { cliente_id: "abc", assunto: "x" },
        })
      )
    ).toBe(400)
    expect(
      await status(
        previewAction(operator, insertId, { values: { assunto: "x" } })
      )
    ).toBe(400)
    // Foreign key violation is a database error, nothing is written.
    expect(
      await status(
        previewAction(operator, insertId, {
          values: { cliente_id: "999999", assunto: "x" },
        })
      )
    ).toBe(400)
  })

  it("conexão de escrita não roda queries de leitura e vice-versa", async () => {
    const connection = (
      await import("@/server/services/connections")
    ).getConnectionRow(writeConnectionId)
    await expect(
      executeQuery({
        user: admin,
        connection: await connection,
        sql: "select 1",
        source: "editor",
      })
    ).rejects.toThrow(/só para ações de escrita/)
    // Switching the connection back to read disables its actions.
    await updateConnection(admin, writeConnectionId, {
      ...writeInput,
      name: `Escrita ${Date.now()}`,
      password: undefined,
      purpose: "read",
    })
    expect(await status(previewAction(operator, insertId, {}))).toBe(400)
    await updateConnection(admin, writeConnectionId, {
      ...writeInput,
      name: `Escrita ${Date.now()}`,
      password: undefined,
      purpose: "write",
    })
  })

  it("admin edita e exclui", async () => {
    const updated = await updateAction(admin, updateId, {
      name: "Mudar status",
      connectionId: writeConnectionId,
      sql: "update loja.solicitacoes set status = :status where id = :id",
    })
    expect(updated.params.map((p) => p.name)).toEqual(["status", "id"])
    expect(await status(deleteAction(operator, updateId))).toBe(403)
    await deleteAction(admin, updateId)
    expect(await status(deleteAction(admin, updateId))).toBe(404)
  })
})

describe("escrita no SQLite", () => {
  const dir = path.resolve("data/sqlite-test")
  beforeAll(() => {
    process.env.SQLBOARD_SQLITE_DIR = dir
    execFileSync("node", ["scripts/demo-sqlite.mjs", "escrita.db"], {
      env: { ...process.env, SQLBOARD_SQLITE_DIR: dir },
    })
  })

  it("grava, faz prévia sem gravar e desfaz acima do limite", async () => {
    const adapter = new SqliteAdapter({
      key: "sqlite-escrita",
      dialect: "sqlite",
      host: "",
      port: null,
      database: "escrita.db",
      username: "",
      password: null,
      ssl: "disable",
      statementTimeoutMs: 10_000,
    })
    const update = compileSql(
      "update clientes set nome = :nome where uf = :uf",
      { nome: "Nome alterado", uf: "CE" },
      { dialect: "sqlite" }
    )
    const count = async () =>
      (
        await adapter.execute(
          compileSql(
            "select count(*) as n from clientes where nome = 'Nome alterado'",
            {},
            { dialect: "sqlite" }
          ),
          { maxRows: 1, timeoutMs: 5000 }
        )
      ).rows[0]![0]
    const preview = await adapter.executeWrite(update, {
      timeoutMs: 5000,
      maxAffectedRows: 1000,
      commit: false,
    })
    expect(preview.affectedRows).toBeGreaterThan(1)
    expect(await count()).toBe(0)
    await expect(
      adapter.executeWrite(update, {
        timeoutMs: 5000,
        maxAffectedRows: 1,
        commit: true,
      })
    ).rejects.toThrow(/acima do limite/)
    expect(await count()).toBe(0)
    const done = await adapter.executeWrite(update, {
      timeoutMs: 5000,
      maxAffectedRows: 1000,
      commit: true,
    })
    expect(done.committed).toBe(true)
    expect(await count()).toBe(preview.affectedRows)
    await expect(
      adapter.executeWrite(compileSql("select 1", {}, { dialect: "sqlite" }), {
        timeoutMs: 5000,
        maxAffectedRows: 1,
        commit: true,
      })
    ).rejects.toThrow(/INSERT ou UPDATE/)
  })
})
