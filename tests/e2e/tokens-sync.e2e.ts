import { execFile } from "node:child_process"
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { promisify } from "node:util"

import { expect, test } from "@playwright/test"

import {
  expectAccessible,
  expectNoHorizontalOverflow,
  grantDemo,
  storageFor,
} from "./support/helpers"

const run = promisify(execFile)

test.describe.configure({ mode: "serial" })

let token = ""
let appId = ""

test.describe("tokens, MCP e versionamento em git", () => {
  test.use({ storageState: storageFor("editor") })

  test("cria token pela tela e usa no MCP", async ({ page, baseURL }) => {
    await page.goto("/settings/tokens")
    await expect(page.getByText("Nenhum token")).toBeVisible()
    await page.getByRole("button", { name: "Novo token" }).click()
    const dialog = page.getByRole("dialog", { name: "Novo token" })
    await dialog.getByLabel("Nome").fill("Agente de testes")
    await dialog.getByRole("button", { name: "Criar token" }).click()
    const created = page.getByRole("dialog", { name: "Token criado" })
    token = await created.getByRole("textbox", { name: "Token" }).inputValue()
    expect(token).toMatch(/^sqlb_/)
    await expect(
      created.getByRole("textbox", { name: "Endereço MCP" })
    ).toHaveValue(/\/api\/mcp$/)
    await expectAccessible(page)
    await created.getByRole("button", { name: "Concluir" }).click()
    await expect(
      page.getByRole("table", { name: "Tokens de API" })
    ).toContainText("Agente de testes")
    // The secret is never listed again.
    await expect(page.getByText(token)).toHaveCount(0)
    await page.setViewportSize({ width: 320, height: 700 })
    await expectNoHorizontalOverflow(page)

    const mcp = await page.request.post(`${baseURL}/api/mcp`, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-06-18",
      },
      data: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
    })
    expect(mcp.status()).toBe(200)
    expect(JSON.stringify(await mcp.json())).toContain("generate_screen")
    // A token cannot manage tokens (browser session only).
    const viaToken = await page.request.get(`${baseURL}/api/tokens`, {
      headers: { authorization: `Bearer ${token}`, cookie: "" },
    })
    expect(viaToken.status()).toBe(401)
  })

  test("exporta e importa pela biblioteca de telas", async ({
    page,
    browser,
  }, info) => {
    const demoId = await grantDemo(browser, info.project.use.baseURL!, "editor")
    const created = await page.request.post("/api/apps", {
      data: { name: "Painel versionado" },
    })
    appId = (await created.json()).id
    const document = {
      schemaVersion: 2,
      app: { id: appId, name: "Painel versionado" },
      queries: [
        {
          id: "q1",
          name: "ufs",
          connectionId: demoId,
          sql: "select uf, count(*) as total from loja.clientes group by uf",
        },
      ],
      pages: [
        {
          id: "p1",
          name: "Página 1",
          widgets: [
            {
              id: "tabela1",
              type: "table",
              grid: { x: 0, y: 0, w: 12, h: 6 },
              props: { title: "Clientes por UF" },
              bindings: { data: "{{ufs.data}}" },
            },
          ],
        },
      ],
    }
    expect(
      (
        await page.request.put(`/api/apps/${appId}/draft`, {
          data: { document },
        })
      ).status()
    ).toBe(200)

    await page.goto("/apps")
    await page
      .getByRole("button", { name: "Ações de Painel versionado" })
      .click()
    const download = page.waitForEvent("download")
    await page.getByRole("menuitem", { name: "Exportar JSON" }).click()
    const file = await download
    expect(file.suggestedFilename()).toBe("painel-versionado.sqlboard.json")
    const exported = await readFile(await file.path(), "utf8")
    expect(JSON.parse(exported).format).toBe("sqlboard-app")

    await page.getByRole("button", { name: "Importar" }).click()
    const dialog = page.getByRole("dialog", { name: "Importar tela" })
    await dialog.getByLabel("Arquivo").setInputFiles({
      name: "painel.json",
      mimeType: "application/json",
      buffer: Buffer.from(exported),
    })
    await expectAccessible(page)
    await dialog.getByRole("button", { name: "Importar" }).click()
    await expect(page).toHaveURL(/\/apps\/[0-9a-f-]{36}\/edit$/)
    expect(page.url()).not.toContain(appId)
    await expect(page.getByText("Clientes por UF").first()).toBeVisible()
  })

  test("pull e push pelo script de sincronização", async ({
    baseURL,
    page,
  }) => {
    const dir = await mkdtemp(path.join(tmpdir(), "sqlboard-apps-"))
    const env = {
      ...process.env,
      SQLBOARD_URL: baseURL!,
      SQLBOARD_TOKEN: token,
    }
    try {
      await run("node", ["scripts/apps-sync.mjs", "pull", dir], { env })
      const files = await readdir(dir)
      expect(files).toContain("painel-versionado.sqlboard.json")
      const target = path.join(dir, "painel-versionado.sqlboard.json")
      const first = await readFile(target, "utf8")
      expect(first).not.toContain("exportedAt")
      // Pulling again gives byte-identical files (clean git diffs).
      await run("node", ["scripts/apps-sync.mjs", "pull", dir], { env })
      expect(await readFile(target, "utf8")).toBe(first)

      const edited = JSON.parse(first)
      edited.document.pages[0].widgets[0].props.title = "Clientes por estado"
      await writeFile(target, JSON.stringify(edited))
      const { stdout } = await run(
        "node",
        ["scripts/apps-sync.mjs", "push", dir],
        { env }
      )
      expect(stdout).toContain("rascunho atualizado")
      const app = await (await page.request.get(`/api/apps/${appId}`)).json()
      expect(JSON.stringify(app.document)).toContain("Clientes por estado")
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
