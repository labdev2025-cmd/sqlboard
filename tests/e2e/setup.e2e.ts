import { expect, test } from "@playwright/test"

import { expectAccessible, login, storageFor, USERS } from "./support/helpers"

test("cadastra o primeiro admin e cria a equipe", async ({ page, browser }) => {
  await page.goto("/login")
  await expect(
    page.getByText("Criar administrador", { exact: true })
  ).toBeVisible()
  await expectAccessible(page)

  const admin = USERS.admin
  await page.getByLabel("Nome").fill(admin.name)
  await page.getByLabel("E-mail").fill(admin.email)
  await page.getByLabel("Senha", { exact: true }).fill(admin.password)
  await page.getByLabel("Confirmar senha").fill(admin.password)
  await page
    .getByRole("button", { name: "Criar conta de administrador" })
    .click()
  await expect(page.getByRole("heading", { name: "Olá, Ana" })).toBeVisible()
  await page.context().storageState({ path: storageFor("admin") })

  // Public sign-up is closed after the first admin.
  const closed = await page.request.post("/api/auth/sign-up/email", {
    data: { name: "X", email: "x@exemplo.test", password: "senha-qualquer-1" },
    headers: { origin: new URL(page.url()).origin },
  })
  expect(closed.status()).toBe(403)

  // The admin creates the rest of the team through the users screen.
  await page.goto("/admin/users")
  await page.getByRole("button", { name: "Novo usuário" }).click()
  const dialog = page.getByRole("dialog", { name: "Novo usuário" })
  await dialog.getByLabel("Nome").fill(USERS.editor.name)
  await dialog.getByLabel("E-mail").fill(USERS.editor.email)
  await dialog.getByLabel("Senha inicial").fill(USERS.editor.password)
  await dialog.getByRole("combobox", { name: "Papel" }).click()
  await page.getByRole("option", { name: "Editor" }).click()
  await dialog.getByRole("button", { name: "Criar conta" }).click()
  await expect(
    page.getByRole("cell", { name: USERS.editor.email })
  ).toBeVisible()

  for (const key of ["viewer", "outsider"] as const) {
    const user = USERS[key]
    const response = await page.request.post("/api/admin/users", {
      data: {
        name: user.name,
        email: user.email,
        password: user.password,
        role: key === "viewer" ? "viewer" : "editor",
      },
    })
    expect(response.status()).toBe(201)
  }

  for (const key of ["editor", "viewer", "outsider"] as const) {
    const context = await browser.newContext()
    const other = await context.newPage()
    await login(other, key)
    await context.storageState({ path: storageFor(key) })
    await context.close()
  }
})
