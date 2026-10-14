import { expect, test } from "@playwright/test"

import { setSql } from "./support/editor"
import {
  expectAccessible,
  expectNoHorizontalOverflow,
  grantDemo,
  storageFor,
} from "./support/helpers"

test.describe.configure({ mode: "serial" })

const SQL =
  "select id, status from loja.pedidos where status = :status order by id limit 5"

test.describe("editor SQL", () => {
  test.use({ storageState: storageFor("editor") })

  test.beforeAll(async ({ browser }, info) => {
    await grantDemo(browser, info.project.use.baseURL!, "editor")
  })

  test("parâmetro, execução, cancelamento, IA, salvar e versões", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    await page.goto("/queries/new")
    await setSql(page, SQL)
    await expect(page.getByRole("textbox", { name: /^status/ })).toBeVisible()
    await page.getByRole("textbox", { name: /^status/ }).fill("entregue")
    await page.getByRole("button", { name: /Executar/ }).click()
    await expect(page.getByText("5 linhas").first()).toBeVisible()
    await expect(
      page
        .getByRole("table", { name: "Resultado da query" })
        .getByText("entregue")
        .first()
    ).toBeVisible()
    await expectAccessible(page, [".cm-editor"])

    // Required parameter left empty → validation message, no execution.
    await page.getByRole("textbox", { name: /^status/ }).fill("")
    await page.locator(".cm-content").click()
    await page.keyboard.press("ControlOrMeta+Enter")
    await expect(page.getByText(/Preencha o parâmetro/)).toBeVisible()
    await page.getByRole("textbox", { name: /^status/ }).fill("entregue")

    // Slow query cancelled from the UI.
    await setSql(page, "select pg_sleep(20) as dormindo")
    await page.getByRole("button", { name: /Executar/ }).click()
    await expect(page.getByText("Executando…")).toBeVisible()
    const started = Date.now()
    await page.getByRole("button", { name: "Cancelar" }).click()
    await expect(page.getByText("Execução cancelada")).toBeVisible()
    expect(Date.now() - started).toBeLessThan(8000)

    // Save to the library.
    await setSql(page, SQL)
    await page.getByRole("textbox", { name: /^status/ }).fill("entregue")
    await page.getByRole("button", { name: "Salvar" }).click()
    const dialog = page.getByRole("dialog", { name: "Salvar na biblioteca" })
    await dialog.getByLabel("Nome").fill("Pedidos por status")
    await dialog
      .getByLabel("Descrição")
      .fill("Lista os pedidos de um status para conferência.")
    await dialog.getByLabel("Tags").fill("vendas, conferência")
    await dialog.getByRole("button", { name: "Salvar" }).click()
    await expect(page).toHaveURL(/\/queries\/[0-9a-f-]{36}$/)
    await expect(page.getByText("Versão 1 · Demo")).toBeVisible()

    // Run to get metrics, then "Melhorar com IA".
    await page.getByRole("textbox", { name: /^status/ }).fill("entregue")
    await page.getByRole("button", { name: /Executar/ }).click()
    await expect(page.getByText("5 linhas").first()).toBeVisible()
    await page.getByRole("button", { name: "Melhorar com IA" }).click()
    const ai = page.getByRole("dialog", { name: "Melhorar com IA" })
    const promptText = await ai
      .getByRole("textbox", { name: "Prompt" })
      .inputValue()
    expect(promptText).toContain("Responda SOMENTE com a query final")
    expect(promptText).toContain("loja.pedidos")
    expect(promptText).toContain("pedidos_data_idx")
    expect(promptText).not.toMatch(/sqlboard_demo_ro|demo_ro_local|localhost/)
    expect(promptText).not.toContain("entregue")
    await ai.getByRole("button", { name: "Copiar" }).click()
    await expect(page.getByText("Prompt copiado").first()).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      "```sql"
    )

    await ai.getByRole("tab", { name: "2. Colar query melhorada" }).click()
    await ai
      .getByRole("textbox", { name: "Resposta da IA" })
      .fill(
        "Claro!\n```sql\nselect p.id, p.status from loja.pedidos p where p.status = :status order by p.id limit 5\n```"
      )
    await expect(
      ai.getByText("Um único comando, com os mesmos parâmetros")
    ).toBeVisible()
    await expect(
      ai.getByRole("textbox", { name: "Query melhorada" })
    ).toBeVisible()
    await ai.getByRole("button", { name: "Comparar execução" }).click()
    await expect(ai.getByText("Resultados idênticos")).toBeVisible()
    await ai.getByRole("button", { name: "Aplicar" }).click()
    await expect(
      page.getByText("Query aplicada no editor").first()
    ).toBeVisible()
    await expect(page.locator(".cm-content")).toContainText(
      "from loja.pedidos p"
    )

    await page.getByRole("button", { name: "Salvar" }).click()
    await page
      .getByRole("dialog", { name: "Salvar query" })
      .getByRole("button", { name: "Salvar" })
      .click()
    await expect(page.getByText("Versão 2 · Demo")).toBeVisible()

    // History: restore v1 creates v3 with the original SQL.
    await page.getByRole("button", { name: "Versões" }).click()
    const sheet = page.getByRole("dialog", { name: "Histórico de versões" })
    await expect(sheet.getByText("v2")).toBeVisible()
    await sheet.getByRole("button", { name: "Restaurar" }).click()
    await expect(page.getByText("Versão 3 · Demo")).toBeVisible()
    await expect(page.locator(".cm-content")).toContainText(
      "from loja.pedidos where"
    )
  })

  test("biblioteca com busca, tag e celular", async ({ page }) => {
    await page.goto("/queries")
    await page
      .getByLabel("Buscar queries por nome, descrição ou tag")
      .fill("conferência")
    await expect(
      page.getByRole("link", { name: /Pedidos por status/ })
    ).toBeVisible()
    await page
      .getByLabel("Buscar queries por nome, descrição ou tag")
      .fill("inexistente-xyz")
    await expect(page.getByText("Nenhuma query encontrada")).toBeVisible()
    await page.getByLabel("Buscar queries por nome, descrição ou tag").fill("")
    await page.getByRole("button", { name: "#vendas" }).click()
    await expect(
      page.getByRole("link", { name: /Pedidos por status/ })
    ).toBeVisible()
    await expectAccessible(page)
    await page.setViewportSize({ width: 320, height: 700 })
    await page.getByRole("link", { name: /Pedidos por status/ }).click()
    await expect(page.locator(".cm-content")).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
})

test.describe("auditoria", () => {
  test.use({ storageState: storageFor("admin") })

  test("admin vê as execuções; leitor não", async ({ page, browser }) => {
    await page.goto("/admin/audit")
    await expect(
      page.getByRole("table", { name: "Execuções de queries" })
    ).toBeVisible()
    await expect(page.getByText("Edu Editor").first()).toBeVisible()
    await expect(page.getByText("cancelada").first()).toBeVisible()
    await expectAccessible(page)
    const viewer = await browser.newContext({
      storageState: storageFor("viewer"),
    })
    const response = await viewer.request.get(
      `${page.url().replace(/\/admin\/audit$/, "")}/api/admin/audit`
    )
    expect(response.status()).toBe(403)
    await viewer.close()
  })
})
