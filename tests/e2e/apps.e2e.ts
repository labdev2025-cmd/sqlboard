import { expect, test, type Page } from "@playwright/test"

import { setSql } from "./support/editor"
import {
  expectAccessible,
  expectNoHorizontalOverflow,
  grantDemo,
  storageFor,
  USERS,
} from "./support/helpers"

test.describe.configure({ mode: "serial" })

let appA = ""
let appB = ""

async function gridValue(page: Page, key: "x" | "y" | "w" | "h") {
  return Number(
    await page
      .getByLabel(new RegExp(`\\(${key}\\)`))
      .first()
      .inputValue()
  )
}

test.describe("construtor de telas", () => {
  test.use({ storageState: storageFor("editor") })

  test.beforeAll(async ({ browser }, info) => {
    const demoId = await grantDemo(browser, info.project.use.baseURL!, "editor")
    const context = await browser.newContext({
      storageState: storageFor("editor"),
      baseURL: info.project.use.baseURL,
    })
    const response = await context.request.post("/api/queries", {
      data: {
        name: "Receita por categoria",
        description: "Receita mensal de uma categoria",
        tags: ["vendas"],
        connectionId: demoId,
        sql: "select mes, categoria, receita from loja.vendas_mensais where categoria = :categoria order by mes",
        params: [
          {
            name: "categoria",
            type: "text",
            required: true,
            default: "Livros",
          },
        ],
      },
    })
    expect([201, 409]).toContain(response.status())
    await context.close()
  })

  test("cria duas telas e encontra pela busca", async ({ page }) => {
    await page.goto("/apps")
    await expectAccessible(page)
    for (const [name, description] of [
      [
        "Receita mensal",
        "Acompanhar a receita por categoria na reunião semanal.",
      ],
      ["Clientes por UF", "Ver onde estão os clientes para planejar entregas."],
    ]) {
      await page.goto("/apps")
      await page
        .getByRole("button", { name: /Nova tela|Criar primeira tela/ })
        .first()
        .click()
      const dialog = page.getByRole("dialog", { name: "Nova tela" })
      await dialog.getByRole("textbox", { name: "Nome" }).fill(name!)
      await dialog
        .getByRole("textbox", { name: "Descrição / finalidade" })
        .fill(description!)
      if (name === "Receita mensal") {
        await dialog.getByRole("combobox", { name: "Começar com" }).click()
        await page
          .getByRole("option", { name: "Query: Receita por categoria" })
          .click()
      }
      await dialog.getByRole("button", { name: "Criar tela" }).click()
      await expect(page).toHaveURL(/\/apps\/[0-9a-f-]{36}\/edit$/)
      const id = page.url().split("/").at(-2)!
      if (name === "Receita mensal") appA = id
      else appB = id
    }

    // Second screen gets its own query, written directly in the screen.
    await page.goto(`/apps/${appB}/edit`)
    await page.getByRole("tab", { name: "Queries" }).first().click()
    await page.getByRole("button", { name: "Nova query" }).first().click()
    const dialog = page.getByRole("dialog", { name: "Query da tela" })
    await dialog.getByRole("textbox", { name: "Nome" }).fill("clientes")
    await setSql(
      page,
      "select uf, count(*) as total from loja.clientes group by uf order by uf",
      0
    )
    await dialog.getByRole("button", { name: "Executar e ver colunas" }).click()
    await expect(dialog.getByText("uf · texto")).toBeVisible()
    await dialog.getByRole("button", { name: "Gerar tela automática" }).click()
    await expect(page.locator("[data-widget-id='barras1']")).toBeVisible()
    await page.getByRole("button", { name: "Salvar" }).click()
    await expect(page.getByText("Salvo", { exact: true })).toBeVisible()

    await page.goto("/apps")
    const search = page.getByLabel("Buscar telas por nome, descrição ou tag")
    await search.fill("reunião semanal")
    await expect(
      page.getByRole("link", { name: "Receita mensal" })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Clientes por UF" })
    ).toHaveCount(0)
    await search.fill("entregas")
    await expect(
      page.getByRole("link", { name: "Clientes por UF" })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Receita mensal" })
    ).toHaveCount(0)
    await search.fill("")

    // Rename/description and delete (with confirmation) from the card menu.
    const temp = await page.request.post("/api/apps", {
      data: { name: "Tela temporária" },
    })
    expect(temp.status()).toBe(201)
    await page.reload()
    await page.getByRole("button", { name: "Ações de Tela temporária" }).click()
    await page.getByRole("menuitem", { name: "Renomear e descrição" }).click()
    const meta = page.getByRole("dialog", { name: "Editar dados da tela" })
    await meta.getByRole("textbox", { name: "Nome" }).fill("Tela descartável")
    await meta.getByRole("button", { name: /Salvar/ }).click()
    await expect(
      page.getByRole("link", { name: "Tela descartável" })
    ).toBeVisible()
    await page
      .getByRole("button", { name: "Ações de Tela descartável" })
      .click()
    await page.getByRole("menuitem", { name: "Excluir" }).click()
    const confirm = page.getByRole("alertdialog")
    await expect(confirm).toContainText("Tela descartável")
    await confirm.getByRole("button", { name: "Excluir" }).click()
    await expect(
      page.getByRole("link", { name: "Tela descartável" })
    ).toHaveCount(0)
  })

  test("gera tela automática, move e redimensiona (mouse e teclado), salva e reabre", async ({
    page,
  }) => {
    await page.goto(`/apps/${appA}/edit`)
    await page.getByRole("tab", { name: "Queries" }).first().click()
    await expect(page.getByText("receita_por_categoria")).toBeVisible()
    await page
      .getByRole("button", { name: "Editar query receita_por_categoria" })
      .click()
    const dialog = page.getByRole("dialog", { name: "Query da tela" })
    await dialog.getByRole("button", { name: "Executar e ver colunas" }).click()
    await expect(dialog.getByText("mes · data")).toBeVisible()
    await expect(dialog.getByText("Gráfico de linha")).toBeVisible()
    await dialog.getByRole("button", { name: "Gerar tela automática" }).click()
    await expect(page.getByText("Tela gerada").first()).toBeVisible()
    const chart = page.locator("[data-widget-id='linha1']")
    await expect(chart).toBeVisible()
    await expect(chart.locator(".recharts-surface")).toBeVisible()
    await expect(page.locator("[data-widget-id='campo1']")).toBeVisible()

    // Keyboard: focus the chart, move right and make it taller.
    await chart.focus()
    await expect(
      page.getByRole("textbox", { name: "Id (usado em bindings)" })
    ).toHaveValue("linha1")
    const startX = await gridValue(page, "x")
    const startH = await gridValue(page, "h")
    await page.keyboard.press("Shift+ArrowLeft")
    await page.keyboard.press("ArrowRight")
    await page.keyboard.press("Shift+ArrowDown")
    await expect.poll(() => gridValue(page, "h")).toBe(startH + 1)
    await expect.poll(() => gridValue(page, "x")).toBe(startX + 1)

    // Numeric fields (no drag needed).
    await page.getByLabel("Largura (w)").fill("6")
    await expect.poll(() => gridValue(page, "w")).toBe(6)

    // Mouse: drag by the handle and resize by the corner.
    const handle = chart.locator(".widget-drag-handle")
    const box = (await handle.boundingBox())!
    await page.mouse.move(box.x + 20, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + 260, box.y + box.height / 2, { steps: 12 })
    await page.mouse.up()
    await expect.poll(() => gridValue(page, "x")).toBeGreaterThan(startX + 1)
    const widthBefore = await gridValue(page, "w")
    // Let the grid finish the move transition before grabbing the corner.
    await page.waitForTimeout(400)
    const corner = (await chart
      .locator(".react-resizable-handle-se")
      .boundingBox())!
    await page.mouse.move(
      corner.x + corner.width / 2,
      corner.y + corner.height / 2
    )
    await page.mouse.down()
    await page.mouse.move(corner.x - 160, corner.y + 60, { steps: 12 })
    await page.mouse.up()
    await expect.poll(() => gridValue(page, "w")).toBeLessThan(widthBefore)
    const finalGrid = {
      x: await gridValue(page, "x"),
      y: await gridValue(page, "y"),
      w: await gridValue(page, "w"),
      h: await gridValue(page, "h"),
    }

    // Undo/redo of one deterministic change (the width field).
    const undoButton = page.getByRole("button", { name: "Desfazer" })
    const redoButton = page.getByRole("button", { name: "Refazer" })
    const changedW = finalGrid.w + 1
    await page.getByLabel("Largura (w)").fill(String(changedW))
    await expect.poll(() => gridValue(page, "w")).toBe(changedW)
    await expect(redoButton).toBeDisabled()
    await undoButton.click()
    await expect.poll(() => gridValue(page, "w")).toBe(finalGrid.w)
    await expect(redoButton).toBeEnabled()
    await redoButton.click()
    await expect.poll(() => gridValue(page, "w")).toBe(changedW)
    await expect(redoButton).toBeDisabled()
    await chart.focus()
    await page.keyboard.press("ControlOrMeta+z")
    await expect.poll(() => gridValue(page, "w")).toBe(finalGrid.w)
    await expect(page.getByLabel("Altura (h)")).toHaveValue(String(finalGrid.h))

    // Edit / view mode switch.
    const editToggle = page.getByRole("button", {
      name: "Editar",
      exact: true,
    })
    const viewToggle = page.getByRole("button", {
      name: "Visualizar",
      exact: true,
    })
    await expect(editToggle).toHaveAttribute("aria-pressed", "true")
    await viewToggle.click()
    await expect(viewToggle).toHaveAttribute("aria-pressed", "true")
    await expect(editToggle).toHaveAttribute("aria-pressed", "false")
    await expect(page.locator("[data-widget-id]")).toHaveCount(0)
    await expect(
      page.getByRole("complementary", { name: "Paleta e queries" })
    ).toHaveCount(0)
    await expect(page.locator(".recharts-surface").first()).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Página", exact: true })
    ).toHaveCount(0)
    await editToggle.click()
    await expect(editToggle).toHaveAttribute("aria-pressed", "true")
    await expect(page.locator("[data-widget-id='linha1']")).toBeVisible()
    await expect(
      page.getByRole("complementary", { name: "Paleta e queries" })
    ).toBeVisible()

    // Autosave (no click on "Salvar"): the draft reaches the server.
    await expect
      .poll(async () => {
        const saved = (await (
          await page.request.get(`/api/apps/${appA}`)
        ).json()) as {
          document: {
            pages: { widgets: { id: string; grid: typeof finalGrid }[] }[]
          }
        }
        return saved.document.pages[0]!.widgets.find((w) => w.id === "linha1")
          ?.grid
      })
      .toEqual(finalGrid)
    await expect(page.getByText("Salvo", { exact: true })).toBeVisible()
    await page.reload()
    await page.locator("[data-widget-id='linha1']").focus()
    expect({
      x: await gridValue(page, "x"),
      y: await gridValue(page, "y"),
      w: await gridValue(page, "w"),
      h: await gridValue(page, "h"),
    }).toEqual(finalGrid)
    await expectAccessible(page, [".cm-editor", ".recharts-wrapper"])
  })

  test("visualiza em desktop e celular, com URL de parâmetros", async ({
    page,
  }) => {
    await page.goto(`/apps/${appA}?mode=draft&p.categoria=Papelaria`)
    await expect(page.getByText("Sobre esta tela")).toBeVisible()
    await expect(
      page.getByText("Acompanhar a receita por categoria")
    ).toBeVisible()
    await expect(page.getByRole("textbox", { name: "categoria" })).toHaveValue(
      "Papelaria"
    )
    await expect(page.locator(".recharts-surface").first()).toBeVisible()
    await expect(page.getByRole("table").first()).toContainText("Papelaria")
    await page.getByRole("textbox", { name: "categoria" }).fill("Livros")
    await expect(page).toHaveURL(/p\.categoria=Livros/)
    await expect(page.getByRole("table").first()).toContainText("Livros")
    await expectAccessible(page, [".recharts-wrapper"])

    // Reading order of the stacked layout: y, then x (from the saved draft).
    const { document } = (await (
      await page.request.get(`/api/apps/${appA}`)
    ).json()) as {
      document: {
        pages: {
          widgets: { id: string; grid: { x: number; y: number } }[]
        }[]
      }
    }
    const widgets = document.pages[0]!.widgets
    expect(widgets.length).toBeGreaterThan(1)
    const expectedOrder = [...widgets]
      .sort((a, b) => a.grid.y - b.grid.y || a.grid.x - b.grid.x)
      .map((w) => w.id)

    for (const viewport of [
      { width: 390, height: 800 },
      { width: 320, height: 640 },
    ]) {
      await page.setViewportSize(viewport)
      await page.reload()
      await expect(page.locator(".recharts-surface").first()).toBeVisible()
      await expectNoHorizontalOverflow(page)
      // Stacked: every widget spans the full width, ordered top to bottom.
      // Grid items are rendered in document order (one per widget).
      const items = page.locator(".react-grid-item")
      await expect(items).toHaveCount(widgets.length)
      const boxes = await items.evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect()
          return { top: r.top, width: r.width }
        })
      )
      const widths = new Set(boxes.map((b) => Math.round(b.width)))
      expect(widths.size).toBe(1)
      const tops = new Set(boxes.map((b) => Math.round(b.top)))
      expect(tops.size).toBe(widgets.length)
      const actualOrder = boxes
        .map((box, index) => ({ id: widgets[index]!.id, top: box.top }))
        .sort((a, b) => a.top - b.top)
        .map((entry) => entry.id)
      expect(actualOrder).toEqual(expectedOrder)
    }
  })

  test("usa query da biblioteca dentro de uma tela existente", async ({
    page,
  }) => {
    await page.goto(`/apps/${appB}/edit`)
    await page.getByRole("tab", { name: "Queries" }).first().click()
    await expect(page.getByText("clientes", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Da biblioteca" }).first().click()
    const library = page.getByRole("dialog", {
      name: "Usar query da biblioteca",
    })
    await library
      .getByRole("textbox", { name: "Buscar na biblioteca" })
      .fill("Receita por categoria")
    const item = library
      .getByRole("listitem")
      .filter({ hasText: "Receita por categoria" })
    await expect(item).toHaveCount(1)
    await item.getByRole("button", { name: "Usar" }).click()
    await expect(library).toBeHidden()

    // The copy opens in the query dialog, with the SQL and its parameter.
    const dialog = page.getByRole("dialog", { name: "Query da tela" })
    await expect(dialog.getByRole("textbox", { name: "Nome" })).toHaveValue(
      "receita_por_categoria"
    )
    await expect(dialog.locator(".cm-content")).toContainText(
      "loja.vendas_mensais"
    )
    await dialog.getByRole("button", { name: "Aplicar" }).click()
    await expect(dialog).toBeHidden()
    await expect(
      page.getByRole("button", { name: "Editar query receita_por_categoria" })
    ).toBeVisible()

    // Autosaved as a snapshot that keeps the reference to the original.
    const libraryId = (
      (await (
        await page.request.get("/api/queries?q=Receita%20por%20categoria")
      ).json()) as { id: string; name: string }[]
    ).find((q) => q.name === "Receita por categoria")!.id
    await expect
      .poll(async () => {
        const saved = (await (
          await page.request.get(`/api/apps/${appB}`)
        ).json()) as {
          document: { queries: { name: string; sourceQueryId?: string }[] }
        }
        return saved.document.queries.find(
          (q) => q.name === "receita_por_categoria"
        )?.sourceQueryId
      })
      .toBe(libraryId)
  })

  test("biblioteca de telas: estado vazio, filtro por tag e por dono", async ({
    page,
    browser,
  }, info) => {
    const baseURL = info.project.use.baseURL!
    const outsider = await browser.newContext({
      storageState: storageFor("outsider"),
      baseURL,
    })
    const admin = await browser.newContext({
      storageState: storageFor("admin"),
      baseURL,
    })
    try {
      const people = (await (await admin.request.get("/api/users")).json()) as {
        id: string
        email: string
      }[]
      const outsiderId = people.find(
        (p) => p.email === USERS.outsider.email
      )!.id

      // Idempotent start: the outsider owns nothing and nothing is shared.
      type Item = { id: string }
      for (const app of (await (
        await outsider.request.get("/api/apps?scope=shared")
      ).json()) as Item[]) {
        await page.request.put(`/api/apps/${app.id}/shares`, {
          data: { shares: [] },
        })
      }
      for (const app of (await (
        await outsider.request.get("/api/apps?scope=mine")
      ).json()) as Item[]) {
        await outsider.request.delete(`/api/apps/${app.id}`)
      }

      const otto = await outsider.newPage()
      await otto.goto("/apps")
      await expect(otto.getByText("Nenhuma tela ainda")).toBeVisible()
      await otto.getByRole("button", { name: "Criar primeira tela" }).click()
      const create = otto.getByRole("dialog", { name: "Nova tela" })
      await create.getByRole("textbox", { name: "Nome" }).fill("Caixa do Otto")
      await create.getByRole("button", { name: "Criar tela" }).click()
      await expect(otto).toHaveURL(/\/apps\/[0-9a-f-]{36}\/edit$/)

      expect(
        (
          await outsider.request.post("/api/apps", {
            data: { name: "Contas a pagar", tags: ["financeiro"] },
          })
        ).status()
      ).toBe(201)
      // The editor shares one of their screens with the outsider.
      expect(
        (
          await page.request.put(`/api/apps/${appB}/shares`, {
            data: { shares: [{ userId: outsiderId, permission: "view" }] },
          })
        ).status()
      ).toBe(200)

      await otto.goto("/apps")
      const link = (name: string) => otto.getByRole("link", { name })
      // Each filter refetches the list: wait for the skeleton to go away.
      const settled = () =>
        expect(otto.locator("[aria-busy='true']")).toHaveCount(0)
      for (const name of ["Caixa do Otto", "Contas a pagar", "Clientes por UF"])
        await expect(link(name)).toBeVisible()

      // Tag filter (single choice; clicking again clears it).
      const tags = otto.getByRole("group", { name: "Filtrar por tag" })
      const financeiro = tags.getByRole("button", { name: "#financeiro" })
      await financeiro.click()
      await expect(financeiro).toHaveAttribute("aria-pressed", "true")
      await settled()
      await expect(link("Contas a pagar")).toBeVisible()
      await expect(link("Caixa do Otto")).toHaveCount(0)
      await expect(link("Clientes por UF")).toHaveCount(0)
      await financeiro.click()
      await expect(financeiro).toHaveAttribute("aria-pressed", "false")
      await settled()
      await expect(link("Clientes por UF")).toBeVisible()

      // Scope filter: mine / shared with me.
      const scope = otto.getByRole("group", { name: "Filtrar telas" })
      await scope.getByRole("button", { name: "Minhas" }).click()
      await settled()
      await expect(link("Caixa do Otto")).toBeVisible()
      await expect(link("Contas a pagar")).toBeVisible()
      await expect(link("Clientes por UF")).toHaveCount(0)
      await scope.getByRole("button", { name: "Compartilhadas comigo" }).click()
      await settled()
      await expect(link("Clientes por UF")).toBeVisible()
      await expect(link("Caixa do Otto")).toHaveCount(0)
      await expect(link("Contas a pagar")).toHaveCount(0)
      await scope.getByRole("button", { name: "Todas" }).click()
      await settled()
      await expect(link("Caixa do Otto")).toBeVisible()
      await expect(link("Clientes por UF")).toBeVisible()
      await expectAccessible(otto)
    } finally {
      await outsider.close()
      await admin.close()
    }
  })
})
