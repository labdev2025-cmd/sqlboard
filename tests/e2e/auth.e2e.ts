import { expect, test } from "@playwright/test"

import {
  expectAccessible,
  expectNoHorizontalOverflow,
  login,
  storageFor,
  USERS,
} from "./support/helpers"

test.describe("autenticação", () => {
  test("login, senha errada e logout", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("E-mail").fill(USERS.admin.email)
    await page.getByLabel("Senha").fill("senha-errada-000")
    await page.getByRole("button", { name: "Entrar" }).click()
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible()

    await login(page, "admin")
    await page
      .getByRole("button", { name: `Conta de ${USERS.admin.name}` })
      .click()
    await page.getByRole("menuitem", { name: "Sair" }).click()
    await expect(page).toHaveURL(/\/login$/)
    await page.goto("/")
    await expect(page).toHaveURL(/\/login$/)
  })

  test("páginas internas exigem sessão", async ({ page }) => {
    await page.goto("/admin/users")
    await expect(page).toHaveURL(/\/login$/)
  })
})

test.describe("viewer", () => {
  test.use({ storageState: storageFor("viewer") })

  test("não acessa a administração (bloqueio no servidor)", async ({
    page,
  }) => {
    await page.goto("/")
    await expect(page.getByRole("link", { name: "Usuários" })).toHaveCount(0)
    await page.goto("/admin/users")
    await expect(page.getByText("Acesso negado")).toBeVisible()
    await expect(page.getByText(USERS.admin.email)).toHaveCount(0)
    const api = await page.request.get("/api/admin/users")
    expect(api.status()).toBe(403)
    const create = await page.request.post("/api/admin/users", {
      data: {
        name: "Hacker",
        email: "h@exemplo.test",
        password: "12345678",
        role: "admin",
      },
    })
    expect(create.status()).toBe(403)
  })
})

test.describe("layout", () => {
  test.use({ storageState: storageFor("admin") })

  test("acessível, navegável por teclado e com tema escuro", async ({
    page,
  }) => {
    await page.goto("/")
    await expectAccessible(page)
    await page.keyboard.press("Tab")
    await expect(
      page.getByRole("link", { name: "Pular para o conteúdo" })
    ).toBeFocused()
    await page
      .getByRole("button", { name: `Conta de ${USERS.admin.name}` })
      .click()
    await page.getByRole("menuitemradio", { name: "Escuro" }).click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.keyboard.press("Escape")
    // Let the menu finish its exit transition (focus guards leave the DOM).
    await expect(page.getByRole("menu")).toHaveCount(0)
    await expect(page.locator("[data-base-ui-focus-guard]")).toHaveCount(0)
    await expectAccessible(page)
  })

  for (const viewport of [
    { name: "celular 320px", width: 320, height: 640 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1280, height: 800 },
  ]) {
    test(`sem rolagem horizontal em ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      for (const path of ["/", "/admin/users"]) {
        await page.goto(path)
        await expect(page.locator("h1")).toBeVisible()
        await expectNoHorizontalOverflow(page)
      }
      if (viewport.width < 768) {
        await page
          .getByRole("button", { name: "Alternar menu lateral" })
          .click()
        const menu = page.getByRole("dialog", { name: "Menu" })
        await expect(menu.getByRole("link", { name: "Usuários" })).toBeVisible()
        await menu.getByRole("link", { name: "Usuários" }).click()
        await expect(page).toHaveURL(/\/admin\/users$/)
      }
    })
  }
})
