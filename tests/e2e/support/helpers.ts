import AxeBuilder from "@axe-core/playwright"
import { expect, type Browser, type Page } from "@playwright/test"

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
  // Colors read mid-transition (dialog fade-in, overlay) give false contrast
  // failures on slower CI machines: wait for running animations first.
  await page.waitForFunction(() =>
    document.getAnimations().every(
      (animation) =>
        animation.playState !== "running" ||
        // Spinners and skeletons loop forever; they never settle.
        animation.effect?.getComputedTiming().iterations === Infinity
    )
  )
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
      nodes: v.nodes
        .slice(0, 3)
        .map((n) => `${n.target.join(" ")} — ${n.failureSummary ?? ""}`),
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

/** Gives an editor access to the seeded "Demo" connection (as admin, via API). */
export async function grantDemo(
  browser: Browser,
  baseURL: string,
  key: UserKey
) {
  const admin = await browser.newContext({
    storageState: storageFor("admin"),
    baseURL,
  })
  try {
    const connections = (await (
      await admin.request.get("/api/connections")
    ).json()) as {
      id: string
      name: string
    }[]
    const demo = connections.find((c) => c.name === "Demo")!
    const people = (await (await admin.request.get("/api/users")).json()) as {
      id: string
      email: string
    }[]
    const current = (await (
      await admin.request.get(`/api/connections/${demo.id}/access`)
    ).json()) as {
      id: string
    }[]
    const target = people.find((p) => p.email === USERS[key].email)!
    const ids = [...new Set([...current.map((p) => p.id), target.id])]
    await admin.request.put(`/api/connections/${demo.id}/access`, {
      data: { userIds: ids },
    })
    return demo.id
  } finally {
    await admin.close()
  }
}
