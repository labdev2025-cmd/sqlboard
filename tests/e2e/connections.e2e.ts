import { expect, test } from "@playwright/test"

import {
  expectAccessible,
  expectNoHorizontalOverflow,
  storageFor,
  USERS,
} from "./support/helpers"
import { E2E_ENV } from "./support/env"

test.describe.configure({ mode: "serial" })

let connectionId = ""

test.describe("conexões (admin)", () => {
  test.use({ storageState: storageFor("admin") })

  test("cadastra, testa, edita e dá acesso", async ({ page }) => {
    await page.goto("/connections/new")
    await expect(
      page.getByText("Use um usuário de banco só com permissão de leitura")
    ).toBeVisible()
    await expectAccessible(page)
    await page.getByLabel("Nome", { exact: true }).fill("Loja leitura")
    await page.getByLabel("Host").fill(E2E_ENV.DEMO_DB_HOST!)
    await page.getByLabel("Porta").fill(E2E_ENV.DEMO_DB_PORT!)
    await page.getByLabel("Banco de dados").fill(E2E_ENV.DEMO_DB_NAME!)
    await page.getByLabel("Usuário").fill(E2E_ENV.DEMO_DB_USER!)
    await page.getByLabel("Senha").fill("senha-errada")
    await page.getByRole("button", { name: "Testar conexão" }).click()
    await expect(page.getByText("Falha ao conectar").first()).toBeVisible()
    await expect(
      page.getByText("Usuário ou senha do banco recusados.")
    ).toBeVisible()
    await page.getByLabel("Senha").fill(E2E_ENV.DEMO_DB_PASSWORD!)
    await page.getByRole("button", { name: "Testar conexão" }).click()
    await expect(page.getByText("Conexão bem-sucedida").first()).toBeVisible()
    await page.getByRole("button", { name: "Salvar" }).click()
    await expect(page).toHaveURL(/\/connections\/[0-9a-f-]{36}$/)
    const id = page.url().split("/").pop()!
    connectionId = id

    // Password never returns to the browser.
    const view = await (await page.request.get(`/api/connections/${id}`)).json()
    expect(view.hasPassword).toBe(true)
    expect(JSON.stringify(view)).not.toContain(E2E_ENV.DEMO_DB_PASSWORD!)
    expect(view).not.toHaveProperty("passwordEnc")
    await expect(page.getByLabel("Senha")).toHaveValue("")
    await expect(page.getByLabel("Senha")).toHaveAttribute(
      "placeholder",
      /Senha definida/
    )

    // Edit keeps the stored password when the field is left empty.
    await page.getByLabel("Descrição").fill("Leitura da loja fictícia")
    await page.getByRole("button", { name: "Salvar" }).click()
    await expect(page.getByText("Conexão salva").first()).toBeVisible()
    await page.getByRole("button", { name: "Testar conexão" }).click()
    await expect(page.getByText("Conexão bem-sucedida").first()).toBeVisible()

    // Schema browser.
    await page.getByRole("tab", { name: "Schema" }).click()
    await expect(
      page.getByRole("button", { name: /loja\.pedidos/ })
    ).toBeVisible()

    // Access: editor Edu may use this connection; Otto may not.
    await page.getByRole("tab", { name: "Acesso" }).click()
    await page
      .getByRole("checkbox", { name: new RegExp(USERS.editor.name) })
      .click()
    await page.getByRole("button", { name: "Salvar permissões" }).click()
    await expect(page.getByText("Permissões salvas").first()).toBeVisible()

    // The demo connection too, for the query tests.
    await page.goto("/connections")
    await page.getByRole("link", { name: /Demo/ }).click()
    await page.getByRole("tab", { name: "Acesso" }).click()
    await page
      .getByRole("checkbox", { name: new RegExp(USERS.editor.name) })
      .click()
    await page.getByRole("button", { name: "Salvar permissões" }).click()
    await expect(page.getByText("Permissões salvas").first()).toBeVisible()
  })

  test("lista sem rolagem horizontal no celular", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await page.goto("/connections")
    await expect(page.getByRole("link", { name: /Loja leitura/ })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
})

test.describe("editor sem permissão", () => {
  test.use({ storageState: storageFor("outsider") })

  test("não vê nem usa a conexão", async ({ page }) => {
    await page.goto("/connections")
    await expect(page.getByText("Nenhuma conexão disponível")).toBeVisible()
    const list = await (await page.request.get("/api/connections")).json()
    expect(list).toEqual([])

    const adminList = await page.request.get("/api/connections/test", {
      failOnStatusCode: false,
    })
    expect([403, 405]).toContain(adminList.status())

    // The real id of a connection the outsider has no access to: 404, like a missing one.
    const anyId = connectionId
    expect(anyId).not.toBe("")
    expect((await page.request.get(`/api/connections/${anyId}`)).status()).toBe(
      404
    )
    const run = await page.request.post("/api/execute", {
      data: { connectionId: anyId, sql: "select 1" },
    })
    expect(run.status()).toBe(404)
    expect(
      (
        await page.request.post("/api/connections", { data: { name: "x" } })
      ).status()
    ).toBe(403)
  })
})

test.describe("editor com permissão", () => {
  test.use({ storageState: storageFor("editor") })

  test("vê a conexão, sem senha e sem editar", async ({ page }) => {
    await page.goto("/connections")
    await page.getByRole("link", { name: /Loja leitura/ }).click()
    await expect(page.getByRole("tab", { name: "Acesso" })).toHaveCount(0)
    await page.getByRole("tab", { name: "Detalhes" }).click()
    await expect(page.getByText("Limite de linhas")).toBeVisible()
    const id = page.url().split("/").pop()!
    const put = await page.request.put(`/api/connections/${id}`, {
      data: { name: "hack" },
    })
    expect(put.status()).toBe(403)
  })
})
