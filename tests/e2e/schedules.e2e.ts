import { readdir, readFile, rm } from "node:fs/promises"
import path from "node:path"

import { expect, test } from "@playwright/test"

import { E2E_ENV } from "./support/env"
import {
  expectAccessible,
  expectNoHorizontalOverflow,
  grantDemo,
  storageFor,
} from "./support/helpers"

const outbox = path.resolve(E2E_ENV.SQLBOARD_OUTBOX_DIR!)

test.describe("agendamentos", () => {
  test.use({ storageState: storageFor("editor") })

  test("cria, executa agora e envia o relatório", async ({
    page,
    browser,
  }, info) => {
    await rm(outbox, { recursive: true, force: true })
    const demoId = await grantDemo(browser, info.project.use.baseURL!, "editor")
    const created = await page.request.post("/api/queries", {
      data: {
        name: "Clientes do estado (agenda)",
        connectionId: demoId,
        sql: "select nome, cidade from loja.clientes where uf = :uf order by nome limit 5",
        params: [{ name: "uf", type: "text", required: true }],
      },
    })
    expect(created.status()).toBe(201)

    await page.goto("/schedules")
    await expect(page.getByText("Nenhum agendamento")).toBeVisible()
    await page.getByRole("button", { name: "Novo agendamento" }).click()
    const dialog = page.getByRole("dialog", { name: "Novo agendamento" })
    await dialog.getByLabel("Nome").fill("Clientes do Ceará")
    await dialog.getByRole("combobox", { name: "Query" }).click()
    await page
      .getByRole("option", { name: "Clientes do estado (agenda)" })
      .click()
    await dialog.getByRole("textbox", { name: "uf" }).fill("CE")
    await dialog.getByRole("combobox", { name: "Formato" }).click()
    await page.getByRole("option", { name: "Excel (XLSX)" }).click()
    await dialog
      .getByLabel("Destinatários")
      .fill("equipe@exemplo.test; vendas@exemplo.test")
    await expectAccessible(page)
    await dialog.getByRole("button", { name: "Salvar" }).click()
    await expect(page.getByText("Agendamento salvo").first()).toBeVisible()

    const table = page.getByRole("table", { name: "Agendamentos" })
    await expect(table).toContainText("Clientes do Ceará")
    await expect(table).toContainText("2 destinatário(s)")
    await expect(table).toContainText("Nunca rodou")

    await page
      .getByRole("button", { name: "Executar agora: Clientes do Ceará" })
      .click()
    await expect(page.getByText("Relatório enviado").first()).toBeVisible()
    await expect(table).toContainText("Enviado")
    const files = await readdir(outbox)
    expect(files).toHaveLength(1)
    const mail = await readFile(path.join(outbox, files[0]!), "utf8")
    expect(mail).toContain("equipe@exemplo.test, vendas@exemplo.test")
    expect(mail).toMatch(/clientes-do-estado-agenda-.*\.xlsx/)
    await expectAccessible(page)

    await page.setViewportSize({ width: 320, height: 700 })
    await expectNoHorizontalOverflow(page)
  })

  test.describe("como leitor", () => {
    test.use({ storageState: storageFor("viewer") })

    test("não acessa agendamentos", async ({ page }) => {
      await page.goto("/schedules")
      await expect(page.getByText("Acesso negado")).toBeVisible()
      expect((await page.request.get("/api/schedules")).status()).toBe(403)
    })
  })
})
