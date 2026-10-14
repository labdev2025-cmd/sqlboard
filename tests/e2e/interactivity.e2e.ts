import { readFile } from "node:fs/promises"

import { expect, test } from "@playwright/test"

import {
  expectAccessible,
  grantDemo,
  storageFor,
  USERS,
} from "./support/helpers"

test.describe.configure({ mode: "serial" })

let appId = ""
let demoId = ""

function table(id: string, x: number, data: string, title: string) {
  return {
    id,
    type: "table",
    grid: { x, y: 0, w: 6, h: 8 },
    props: { title, columns: [], pageSize: 10, searchable: true },
    bindings: { data },
  }
}

test.describe("interatividade, versões e compartilhamento", () => {
  test.use({ storageState: storageFor("editor") })

  test.beforeAll(async ({ browser }, info) => {
    demoId = await grantDemo(browser, info.project.use.baseURL!, "editor")
  })

  test("liga parâmetro ao clique, publica e compartilha", async ({ page }) => {
    const created = await page.request.post("/api/apps", {
      data: {
        name: "Clientes por estado",
        description: "Clique num estado para ver os clientes.",
        tags: ["clientes"],
      },
    })
    expect(created.status()).toBe(201)
    appId = (await created.json()).id
    const document = {
      schemaVersion: 2,
      app: {
        id: appId,
        name: "Clientes por estado",
        description: "Clique num estado para ver os clientes.",
        tags: ["clientes"],
      },
      queries: [
        {
          id: "q1",
          name: "ufs",
          connectionId: demoId,
          sql: "select uf, count(*) as total from loja.clientes group by uf order by uf",
          params: [],
          runMode: "auto",
        },
        {
          id: "q2",
          name: "clientes_uf",
          connectionId: demoId,
          sql: "select nome, cidade, uf from loja.clientes where uf = :uf order by nome limit 10",
          params: [{ name: "uf", type: "text", required: true }],
          runMode: "auto",
        },
        {
          id: "q3",
          name: "pedidos_status",
          connectionId: demoId,
          sql: "select count(*) as pedidos from loja.pedidos where status = :status",
          params: [
            {
              name: "status",
              type: "text",
              required: true,
              default: "entregue",
            },
          ],
          runMode: "manual",
        },
      ],
      pages: [
        {
          id: "p1",
          name: "Estados",
          widgets: [
            table("tabela1", 0, "{{ufs.data}}", "Clientes por UF"),
            table(
              "tabela2",
              6,
              "{{clientes_uf.data}}",
              "Clientes da UF {{tabela1.selectedRow.uf}}"
            ),
            {
              id: "botao1",
              type: "button",
              grid: { x: 0, y: 8, w: 3, h: 2 },
              props: {
                label: "Ver pedidos",
                action: "navigate",
                query: "",
                format: "csv",
                page: "p2",
              },
              bindings: {},
            },
          ],
        },
        {
          id: "p2",
          name: "Pedidos",
          widgets: [
            {
              id: "kpi1",
              type: "kpi",
              grid: { x: 0, y: 0, w: 4, h: 3 },
              props: {
                title: "Pedidos no status",
                value: "pedidos",
                compare: "",
                format: "number",
                description: "",
              },
              bindings: { data: "{{pedidos_status.data}}" },
            },
          ],
        },
      ],
    }
    const saved = await page.request.put(`/api/apps/${appId}/draft`, {
      data: { document },
    })
    expect(saved.status()).toBe(200)

    // The editor binds :uf to the clicked row of tabela1 through the UI.
    await page.goto(`/apps/${appId}/edit`)
    await expect(
      page.getByRole("table", { name: "Clientes por UF" })
    ).toContainText("CE")
    await page.getByRole("tab", { name: "Queries" }).first().click()
    await page.getByRole("button", { name: "Editar query clientes_uf" }).click()
    const dialog = page.getByRole("dialog", { name: "Query da tela" })
    await dialog.getByRole("combobox", { name: ":uf vem de" }).click()
    await page
      .getByRole("option", { name: "{{tabela1.selectedRow.uf}}" })
      .click()
    await dialog.getByRole("button", { name: "Aplicar" }).click()
    await page.getByRole("button", { name: "Salvar" }).click()
    await expect(page.getByText("Salvo", { exact: true })).toBeVisible()

    // Publish v1 and share with the viewer.
    await page.getByRole("button", { name: "Publicar" }).click()
    await page
      .getByRole("dialog", { name: "Publicar tela" })
      .getByRole("button", { name: "Publicar" })
      .click()
    await expect(page.getByText("Versão 1 publicada").first()).toBeVisible()
    await page.getByRole("button", { name: "Compartilhar" }).click()
    const share = page.getByRole("dialog", { name: "Compartilhar tela" })
    await share.getByRole("combobox", { name: "Adicionar pessoa" }).click()
    await page
      .getByRole("option", { name: new RegExp(USERS.viewer.name) })
      .click()
    await share.getByRole("button", { name: "Adicionar" }).click()
    await share.getByRole("button", { name: "Salvar" }).click()
    await expect(page.getByText("Compartilhamento salvo").first()).toBeVisible()

    // A later draft change must not reach the published version.
    const current = await (await page.request.get(`/api/apps/${appId}`)).json()
    current.document.pages[0].widgets[0].props.title = "Título só no rascunho"
    expect(
      (
        await page.request.put(`/api/apps/${appId}/draft`, {
          data: { document: current.document },
        })
      ).status()
    ).toBe(200)
  })

  test.describe("como leitor", () => {
    test.use({ storageState: storageFor("viewer") })

    test("vê a versão publicada, filtra encadeado, navega, executa manual e exporta", async ({
      page,
    }) => {
      await page.goto("/apps")
      await page.getByRole("link", { name: "Clientes por estado" }).click()
      await expect(page).toHaveURL(new RegExp(`/apps/${appId}(\\?|$)`))
      await expect(
        page.getByRole("table", { name: "Clientes por UF" })
      ).toBeVisible()
      await expect(page.getByText("Título só no rascunho")).toHaveCount(0)
      // Readers never receive the SQL nor the connection of the queries.
      const view = await (
        await page.request.get(`/api/apps/${appId}/view`)
      ).json()
      expect(view.permission).toBe("view")
      expect(JSON.stringify(view.document)).not.toContain("loja.clientes")
      expect(await page.content()).not.toContain("from loja.clientes")
      await expect(page.getByText("Preencha: uf.")).toBeVisible()
      await expectAccessible(page, [".recharts-wrapper"])

      // Chained filter: click a state, the second table follows.
      await page
        .getByRole("table", { name: "Clientes por UF" })
        .getByRole("row", { name: /^CE/ })
        .click()
      const detail = page.getByRole("table", { name: "Clientes da UF CE" })
      await expect(detail).toBeVisible()
      await expect(detail.getByRole("row").nth(1)).toContainText("CE")
      // Keyboard works too.
      const sp = page
        .getByRole("table", { name: "Clientes por UF" })
        .getByRole("row", { name: /^SP/ })
      await sp.focus()
      await page.keyboard.press("Enter")
      await expect(
        page.getByRole("table", { name: "Clientes da UF SP" })
      ).toBeVisible()

      // Export the detail as CSV.
      const download = page.waitForEvent("download")
      await page
        .getByRole("button", { name: "Exportar dados de Clientes da UF SP" })
        .click()
      await page.getByRole("menuitem", { name: "Exportar CSV" }).click()
      const file = await download
      expect(file.suggestedFilename()).toMatch(
        /^clientes-por-estado-clientes_uf-.*\.csv$/
      )
      const content = await readFile(await file.path(), "utf8")
      expect(content).toContain("nome,cidade,uf")
      expect(content).toContain(",SP")

      // Second page, manual query: runs only on "Executar".
      await page.getByRole("button", { name: "Ver pedidos" }).click()
      await expect(page.getByRole("tab", { name: "Pedidos" })).toHaveAttribute(
        "aria-selected",
        "true"
      )
      await expect(page.getByRole("textbox", { name: "status" })).toHaveValue(
        "entregue"
      )
      await expect(page.getByText("Aguardando a execução.")).toBeVisible()
      await page.getByRole("button", { name: "Executar" }).click()
      await expect(
        page.getByRole("region", { name: "Pedidos no status" })
      ).toContainText(/\d/)

      // Viewers cannot edit nor run the draft.
      await page.goto(`/apps/${appId}/edit`)
      await expect(
        page.getByText("Você pode visualizar esta tela, mas não editá-la.")
      ).toBeVisible()
      const draftRun = await page.request.post(`/api/apps/${appId}/run`, {
        data: { queryId: "q1", mode: "draft" },
      })
      expect(draftRun.status()).toBe(403)
    })
  })

  test("histórico de versões e restauração no rascunho", async ({ page }) => {
    await page.goto(`/apps/${appId}/edit`)
    await expect(page.getByText("Título só no rascunho")).toBeVisible()
    await page.getByRole("button", { name: "Versões" }).click()
    const sheet = page.getByRole("dialog", { name: "Versões publicadas" })
    await expect(sheet.getByText("v1")).toBeVisible()
    await sheet.getByRole("button", { name: "Restaurar" }).click()
    await expect(
      page.getByText("Versão 1 restaurada no rascunho").first()
    ).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByText("Clientes por UF").first()).toBeVisible()
    await expect(page.getByText("Título só no rascunho")).toHaveCount(0)
  })
})
