import AxeBuilder from "@axe-core/playwright"
import { expect, type Page } from "@playwright/test"

export const USERS = {
  admin: {
    name: "Ana Admin",
    email: "ana@exemplo.test",
    password: "senha-admin-123",
  },
  editor: {
    name: "Edu Editor",
    email: "edu@exemplo.test",
    password: "senha-editor-123",
  },
  viewer: {
    name: "Vera Leitora",
    email: "vera@exemplo.test",
    password: "senha-viewer-123",
  },
  outsider: {
    name: "Otto Editor",
    email: "otto@exemplo.test",
    password: "senha-otto-123",
  },
} as const

export type UserKey = keyof typeof USERS

export const storageFor = (key: UserKey) => `tests/e2e/.auth/${key}.json`

/** Fails on serious or critical axe violations (WCAG 2.x A/AA rules). */
export async function expectAccessible(page: Page, exclude: string[] = []) {
  let builder = new AxeBuilder({ page }).withTags([
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
    "wcag22aa",
  ])
  for (const selector of exclude) builder = builder.exclude(selector)
  const results = await builder.analyze()
  const serious = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical"
  )
  expect(
    serious.map((v) => ({
      id: v.id,
      help: v.help,
      nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
    }))
  ).toEqual([])
}

/** No accidental horizontal page scroll at the current viewport. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  expect(overflow).toBeLessThanOrEqual(1)
}

export async function login(page: Page, key: UserKey) {
  const user = USERS[key]
  await page.goto("/login")
  await page.getByLabel("E-mail").fill(user.email)
  await page.getByLabel("Senha").fill(user.password)
  await page.getByRole("button", { name: "Entrar" }).click()
  await expect(page).toHaveURL(/\/$/)
}
