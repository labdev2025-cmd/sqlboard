import { expect, test } from "@playwright/test"

import {
  expectAccessible,
  expectNoHorizontalOverflow,
  grantDemo,
  storageFor,
} from "./support/helpers"

const PAGES: { path: string; heading: string | RegExp }[] = [
  { path: "/", heading: /^Olá, / },
  { path: "/apps", heading: "Telas" },
  { path: "/queries", heading: "Queries" },
  { path: "/connections", heading: "Conexões" },
  { path: "/schedules", heading: "Agendamentos" },
  { path: "/actions", heading: "Ações de escrita" },
  { path: "/settings/tokens", heading: "Tokens de API" },
  { path: "/admin/users", heading: "Usuários" },
  { path: "/admin/audit", heading: "Auditoria" },
]

const WIDTHS = [320, 768, 1280]

test.describe("responsividade e acessibilidade de todas as telas", () => {
  test.use({ storageState: storageFor("admin") })

  for (const { path, heading } of PAGES) {
    test(`${path}: 320/768/1280 px, claro e escuro`, async ({ page }) => {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 800 })
        await page.goto(path)
        await expect(
          page.getByRole("heading", { level: 1, name: heading })
        ).toBeVisible()
        await expectNoHorizontalOverflow(page)
      }
      await page.setViewportSize({ width: 320, height: 640 })
      await expectAccessible(page)
      await page.emulateMedia({ colorScheme: "dark" })
      await page.reload()
      await expect(
        page.getByRole("heading", { level: 1, name: heading })
      ).toBeVisible()
      await expectAccessible(page)
    })
  }

  test("página inexistente mostra aviso em português", async ({ page }) => {
    await page.goto("/rota-que-nao-existe")
    await expect(page.getByText("Página não encontrada")).toBeVisible()
  })
})

test.describe("construtor em tela estreita", () => {
  test.use({ storageState: storageFor("editor") })

  test("paleta e propriedades viram painéis laterais no celular", async ({
    page,
    browser,
  }, info) => {
    await grantDemo(browser, info.project.use.baseURL!, "editor")
    const created = await page.request.post("/api/apps", {
      data: { name: `Tela estreita ${Date.now()}` },
    })
    const { id } = await created.json()
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto(`/apps/${id}/edit`)
    await expectNoHorizontalOverflow(page)

    await page.getByRole("button", { name: "Componentes" }).click()
    const palette = page.getByRole("dialog", { name: "Componentes e queries" })
    await expect(palette).toBeVisible()
    await expectAccessible(page)
    await palette.getByRole("button", { name: /Texto/ }).first().click()
    await page.keyboard.press("Escape")
    await expect(palette).toHaveCount(0)

    await page.getByRole("button", { name: "Propriedades" }).click()
    const properties = page.getByRole("dialog", { name: "Propriedades" })
    await expect(properties).toBeVisible()
    await expectAccessible(page)
    await page.keyboard.press("Escape")
    await expectNoHorizontalOverflow(page)

    await page.setViewportSize({ width: 820, height: 1180 })
    await expectNoHorizontalOverflow(page)
  })
})
