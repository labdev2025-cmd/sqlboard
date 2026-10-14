import { readFile } from "node:fs/promises"

import { expect, test, type APIRequestContext } from "@playwright/test"

import {
  expectAccessible,
  expectNoHorizontalOverflow,
  storageFor,
} from "./support/helpers"

test.describe.configure({ mode: "serial" })

let token = ""

async function mcpCall(
  request: APIRequestContext,
  baseURL: string,
  name: string,
  args: object
) {
  const response = await request.post(`${baseURL}/api/mcp`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-06-18",
    },
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    },
  })
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body.result.isError ?? false).toBe(false)
  return JSON.parse(body.result.content[0].text)
}

test.describe("conectar IA", () => {
  test.use({ storageState: storageFor("admin") })

  test("gera token, mostra a configuração de cada IA, testa e baixa a skill", async ({
    page,
  }) => {
    await page.goto("/")
    await page.getByRole("link", { name: "Conectar IA" }).first().click()
    await expect(page).toHaveURL(/\/ai$/)
    await expect(
      page.getByRole("heading", { name: "Conectar IA" })
    ).toBeVisible()

    await page.getByRole("button", { name: "Gerar token" }).click()
    const tokenField = page.getByRole("textbox", { name: "Token" })
    await expect(tokenField).toHaveValue(/^sqlb_/)
    token = await tokenField.inputValue()

    const claudeCode = page.getByLabel("Configuração do Claude Code", {
      exact: true,
    })
    await expect(claudeCode).toContainText("claude mcp add --transport http")
    await expect(claudeCode).toContainText(`Bearer ${token}`)
    await expect(claudeCode).toContainText("/api/mcp")

    await page.getByRole("tab", { name: "Codex" }).click()
    await expect(
      page.getByLabel("Configuração do Codex", { exact: true })
    ).toContainText("[mcp_servers.sqlboard]")

    await page.getByRole("button", { name: "Testar conexão" }).click()
    await expect(page.getByText("Conectado", { exact: true })).toBeVisible()

    const download = page.waitForEvent("download")
    await page.getByRole("button", { name: "Baixar SKILL.md" }).click()
    const file = await download
    expect(file.suggestedFilename()).toBe("SKILL.md")
    const skill = await readFile((await file.path())!, "utf8")
    expect(skill).toContain("name: sqlboard")
    expect(skill).toContain("get_schema")
    // The skill never carries the token.
    expect(skill).not.toContain(token)

    await expectAccessible(page)
    await page.setViewportSize({ width: 320, height: 700 })
    await expectNoHorizontalOverflow(page)
  })

  test("o construtor mostra ao vivo o que a IA faz na tela", async ({
    page,
    baseURL,
  }) => {
    const created = await mcpCall(page.request, baseURL!, "create_app", {
      name: `Tela feita pela IA ${Date.now()}`,
    })
    await page.goto(`/apps/${created.id}/edit`)
    await expect(page.getByText("Salvo", { exact: true })).toBeVisible()

    await mcpCall(page.request, baseURL!, "add_widget", {
      appId: created.id,
      type: "text",
      props: { content: "Olá, escrito pela IA" },
    })
    await expect(page.getByText("Tela atualizada")).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText("Olá, escrito pela IA")).toBeVisible()

    const added = await mcpCall(page.request, baseURL!, "add_page", {
      appId: created.id,
      name: "Detalhes da IA",
    })
    expect(added.pageId).toBeTruthy()
    await expect(page.getByRole("tab", { name: "Detalhes da IA" })).toBeVisible(
      { timeout: 15_000 }
    )

    // The external change is one undo step.
    await page.getByRole("button", { name: "Desfazer" }).click()
    await expect(page.getByRole("tab", { name: "Detalhes da IA" })).toHaveCount(
      0
    )
  })
})
