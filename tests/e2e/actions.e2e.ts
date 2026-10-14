import { expect, test } from "@playwright/test"

import { E2E_ENV } from "./support/env"
import {
  expectAccessible,
  expectNoHorizontalOverflow,
  storageFor,
  USERS,
} from "./support/helpers"

test.describe.configure({ mode: "serial" })

const actionName = "Abrir solicitação de atendimento"

test.describe("ações de escrita (admin cadastra)", () => {
  test.use({ storageState: storageFor("admin") })

  test("cadastra conexão de escrita e a ação", async ({ page }) => {
    const created = await page.request.post("/api/connections", {
      data: {
        name: "Loja escrita",
        dialect: "postgres",
        host: E2E_ENV.DEMO_DB_HOST,
        port: Number(E2E_ENV.DEMO_DB_PORT),
        database: E2E_ENV.DEMO_DB_NAME,
        username: E2E_ENV.DEMO_DB_WRITE_USER,
        password: E2E_ENV.DEMO_DB_WRITE_PASSWORD,
        purpose: "write",
      },
    })
    // 409 on a CI retry: reuse the connection from the first attempt.
    expect([201, 409]).toContain(created.status())
    const connection =
      created.status() === 201
        ? await created.json()
        : (
            (await (await page.request.get("/api/connections")).json()) as {
              id: string
              name: string
            }[]
          ).find((c) => c.name === "Loja escrita")!
    const people = (await (await page.request.get("/api/users")).json()) as {
      id: string
      email: string
    }[]
    const editor = people.find((p) => p.email === USERS.editor.email)!
    await page.request.put(`/api/connections/${connection.id}/access`, {
      data: { userIds: [editor.id] },
    })

    // A CI retry starts from the first attempt's leftovers.
    const existing = (await (
      await page.request.get("/api/actions")
    ).json()) as {
      id: string
      name: string
    }[]
    for (const action of existing.filter((a) => a.name === actionName)) {
      await page.request.delete(`/api/actions/${action.id}`)
    }

    await page.goto("/actions")
    await page.getByRole("button", { name: "Nova ação" }).click()
    const dialog = page.getByRole("dialog", { name: "Nova ação" })
    await dialog.getByLabel("Nome").fill(actionName)
    await dialog.getByRole("combobox", { name: "Conexão de escrita" }).click()
    await page.getByRole("option", { name: "Loja escrita" }).click()
    // A DELETE is refused by the server.
    await dialog.getByLabel("Comando SQL").fill("delete from loja.solicitacoes")
    await dialog.getByRole("button", { name: "Salvar" }).click()
    await expect(dialog.getByRole("alert")).toContainText("INSERT ou UPDATE")
    await dialog
      .getByLabel("Comando SQL")
      .fill(
        "insert into loja.solicitacoes (cliente_id, assunto) values (:cliente_id, :assunto)"
      )
    await expect(
      dialog.getByRole("combobox", { name: ":cliente_id" })
    ).toHaveText(/Inteiro/)
    await expectAccessible(page)
    await dialog.getByRole("button", { name: "Salvar" }).click()
    await expect(page.getByText("Ação salva").first()).toBeVisible()
    await expect(page.getByText(actionName)).toBeVisible()
  })
})

test.describe("ações de escrita (editor executa)", () => {
  test.use({ storageState: storageFor("editor") })

  test("prévia, confirmação e auditoria", async ({ page }) => {
    await page.goto("/actions")
    await expect(page.getByRole("button", { name: "Nova ação" })).toHaveCount(0)
    await page.getByRole("button", { name: `Executar ${actionName}` }).click()
    const dialog = page.getByRole("dialog", { name: actionName })
    const subject = `Pedido chegou incompleto ${Date.now()}`
    await dialog.getByRole("textbox", { name: "cliente_id" }).fill("5")
    await dialog.getByRole("textbox", { name: "assunto" }).fill(subject)
    await dialog.getByRole("button", { name: "Gerar prévia" }).click()
    await expect(dialog.getByText("1 linha(s) serão afetadas")).toBeVisible()
    await expect(dialog.getByLabel("Comando que será executado")).toContainText(
      "$2"
    )
    await expect(
      dialog.getByRole("table", { name: "Valores enviados" })
    ).toContainText(subject)
    await expectAccessible(page)
    await dialog.getByRole("button", { name: "Confirmar e gravar" }).click()
    await expect(page.getByText("Gravado").first()).toBeVisible()
    await expect(dialog).toHaveCount(0)

    await page.setViewportSize({ width: 320, height: 700 })
    await expectNoHorizontalOverflow(page)
  })

  test.describe("como leitor", () => {
    test.use({ storageState: storageFor("viewer") })

    test("não acessa ações", async ({ page }) => {
      await page.goto("/actions")
      await expect(page.getByText("Acesso negado")).toBeVisible()
      expect((await page.request.get("/api/actions")).status()).toBe(403)
    })
  })
})

test.describe("auditoria (admin)", () => {
  test.use({ storageState: storageFor("admin") })

  test("registra a gravação com o usuário", async ({ page }) => {
    const response = await page.request.get("/api/admin/audit?source=action")
    expect(response.status()).toBe(200)
    const body = await response.json()
    const rows = (body.rows ?? body) as {
      queryName: string
      status: string
      rowCount: number
    }[]
    expect(
      rows.some(
        (r) =>
          r.queryName === actionName && r.status === "ok" && r.rowCount === 1
      )
    ).toBe(true)
  })
})
