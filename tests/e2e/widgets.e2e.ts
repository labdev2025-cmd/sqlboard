import { readFile } from "node:fs/promises"

import { expect, test } from "@playwright/test"

import { expectAccessible, grantDemo, storageFor } from "./support/helpers"

type W = {
  id: string
  type: string
  grid: { x: number; y: number; w: number; h: number }
  props: Record<string, unknown>
  bindings?: Record<string, string>
}

let row = 0
function at(w: number, h: number, x = 0) {
  const grid = { x, y: row, w, h }
  if (x + w >= 12) row += h
  return grid
}

test.describe("todos os componentes do MVP", () => {
  test.use({ storageState: storageFor("editor") })

  test("renderizam em modo visualização, com opções vindas de query e aviso de truncamento", async ({
    page,
    browser,
  }, info) => {
    const demoId = await grantDemo(browser, info.project.use.baseURL!, "editor")
    const created = await page.request.post("/api/apps", {
      data: { name: `Vitrine de componentes ${Date.now()}` },
    })
    const appId = (await created.json()).id
    row = 0
    const widgets: W[] = [
      {
        id: "texto1",
        type: "text",
        grid: at(12, 2),
        props: { content: "## Painel **fictício**" },
      },
      {
        id: "uf",
        type: "select",
        grid: at(4, 3),
        props: {
          label: "Estado",
          param: "uf",
          optionsQuery: "ufs",
          optionsColumn: "uf",
        },
      },
      {
        id: "segmentos",
        type: "multi-select",
        grid: at(4, 3, 4),
        props: {
          label: "Segmentos",
          param: "segmentos",
          options: "Varejo\nAtacado",
        },
      },
      {
        id: "ativos",
        type: "switch",
        grid: at(4, 3, 8),
        props: { label: "Só ativos", param: "ativos" },
      },
      {
        id: "busca",
        type: "text-input",
        grid: at(3, 3),
        props: { label: "Busca", param: "busca" },
      },
      {
        id: "minimo",
        type: "number-input",
        grid: at(3, 3, 3),
        props: { label: "Mínimo", param: "minimo" },
      },
      {
        id: "dia",
        type: "date-input",
        grid: at(3, 3, 6),
        props: { label: "Dia", param: "dia" },
      },
      {
        id: "periodo",
        type: "date-range",
        grid: at(3, 3, 9),
        props: { label: "Período", paramStart: "inicio", paramEnd: "fim" },
      },
      {
        id: "kpi1",
        type: "kpi",
        grid: at(6, 3),
        props: {
          title: "Clientes",
          value: "total",
          compare: "anterior",
          format: "number",
        },
        bindings: { data: "{{resumo.data}}" },
      },
      {
        id: "botao1",
        type: "button",
        grid: at(6, 3, 6),
        props: { label: "Atualizar", action: "run", query: "resumo" },
      },
      {
        id: "barras1",
        type: "bar-chart",
        grid: at(6, 6),
        props: { title: "Barras por UF", x: "uf", y: ["total"] },
        bindings: { data: "{{ufs.data}}" },
      },
      {
        id: "linha1",
        type: "line-chart",
        grid: at(6, 6, 6),
        props: { title: "Linha por UF", x: "uf", y: ["total"] },
        bindings: { data: "{{ufs.data}}" },
      },
      {
        id: "area1",
        type: "area-chart",
        grid: at(6, 6),
        props: { title: "Área por UF", x: "uf", y: ["total"] },
        bindings: { data: "{{ufs.data}}" },
      },
      {
        id: "pizza1",
        type: "pie-chart",
        grid: at(6, 6, 6),
        props: { title: "Pizza por UF", label: "uf", value: "total" },
        bindings: { data: "{{ufs.data}}" },
      },
      {
        id: "tabela1",
        type: "table",
        grid: at(12, 8),
        props: { title: "Clientes do estado" },
        bindings: { data: "{{clientes_uf.data}}" },
      },
      {
        id: "tabela2",
        type: "table",
        grid: at(12, 8),
        props: { title: "Muitas linhas" },
        bindings: { data: "{{muitas.data}}" },
      },
    ]
    const document = {
      schemaVersion: 2,
      app: { id: appId, name: "Vitrine" },
      queries: [
        {
          id: "q1",
          name: "ufs",
          connectionId: demoId,
          sql: "select uf, count(*) as total from loja.clientes group by uf order by uf",
        },
        {
          id: "q2",
          name: "clientes_uf",
          connectionId: demoId,
          sql: "select nome, uf from loja.clientes where uf = :uf order by nome limit 20",
          params: [{ name: "uf", type: "text", required: true }],
        },
        {
          id: "q3",
          name: "resumo",
          connectionId: demoId,
          sql: "select count(*) as total, count(*) - 1 as anterior from loja.clientes",
        },
        {
          id: "q4",
          name: "muitas",
          connectionId: demoId,
          sql: "select n from generate_series(1, 6000) as n",
        },
      ],
      pages: [{ id: "p1", name: "Vitrine", widgets }],
    }
    expect(
      (
        await page.request.put(`/api/apps/${appId}/draft`, {
          data: { document },
        })
      ).status()
    ).toBe(200)
    expect(
      (
        await page.request.post(`/api/apps/${appId}/publish`, { data: {} })
      ).status()
    ).toBe(200)

    await page.goto(`/apps/${appId}`)
    await expect(
      page.getByRole("heading", { name: "Painel fictício" })
    ).toBeVisible()
    for (const name of [
      "Barras por UF",
      "Linha por UF",
      "Área por UF",
      "Pizza por UF",
    ]) {
      await expect(
        page.getByRole("region", { name }).getByRole("img")
      ).toBeVisible()
    }
    await expect(
      page.getByRole("region", { name: "Clientes", exact: true })
    ).toContainText(/\d/)
    for (const label of [
      "Busca",
      "Mínimo",
      "Dia",
      "Período — início",
      "Período — fim",
      "Segmentos",
      "Só ativos",
    ]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    }
    await expect(page.getByRole("button", { name: "Atualizar" })).toBeVisible()

    // Select whose options come from another query feeds the chained table.
    await page.getByRole("combobox", { name: "Estado" }).click()
    await page.getByRole("option", { name: "CE" }).click()
    await expect(
      page
        .getByRole("table", { name: "Clientes do estado" })
        .getByRole("row")
        .nth(1)
    ).toContainText("CE")

    // 6,000 rows with the default limit of 5,000: the table says so.
    await expect(
      page.getByRole("region", { name: "Muitas linhas" })
    ).toContainText("o resultado tem mais")
    await expectAccessible(page, [".recharts-wrapper"])
  })

  test("KPI compara com o anterior; entradas e botões mudam as queries dependentes", async ({
    page,
    browser,
  }, info) => {
    const demoId = await grantDemo(browser, info.project.use.baseURL!, "editor")
    const created = await page.request.post("/api/apps", {
      data: { name: `Entradas e botões ${Date.now()}` },
    })
    const appId = (await created.json()).id
    const kpi = (id: string, title: string, query: string, x: number) => ({
      id,
      type: "kpi",
      grid: { x, y: 0, w: 3, h: 3 },
      props: { title, value: "total", compare: "anterior", format: "number" },
      bindings: { data: `{{${query}.data}}` },
    })
    const widgets: W[] = [
      kpi("kpi_alta", "Receita", "alta", 0),
      kpi("kpi_queda", "Devoluções", "queda", 3),
      {
        id: "minimo",
        type: "number-input",
        grid: { x: 0, y: 3, w: 3, h: 3 },
        props: { label: "Mínimo", param: "minimo" },
      },
      {
        id: "kpi_acima",
        type: "kpi",
        grid: { x: 3, y: 3, w: 3, h: 3 },
        props: { title: "Acima do mínimo", value: "total", format: "number" },
        bindings: { data: "{{acima.data}}" },
      },
      {
        id: "ativos",
        type: "switch",
        grid: { x: 6, y: 3, w: 3, h: 3 },
        props: { label: "Só ativos", param: "ativos" },
      },
      {
        id: "estado_texto",
        type: "text",
        grid: { x: 9, y: 3, w: 3, h: 3 },
        props: { content: "Filtro: {{estado.data[0].estado}}" },
      },
      {
        id: "periodo",
        type: "date-range",
        grid: { x: 0, y: 6, w: 6, h: 3 },
        props: { label: "Período", paramStart: "inicio", paramEnd: "fim" },
      },
      {
        id: "kpi_dias",
        type: "kpi",
        grid: { x: 6, y: 6, w: 3, h: 3 },
        props: { title: "Dias no período", value: "dias", format: "number" },
        bindings: { data: "{{dias.data}}" },
      },
      {
        id: "instante_texto",
        type: "text",
        grid: { x: 0, y: 9, w: 6, h: 2 },
        props: { content: "Instante: {{agora.data[0].instante}}" },
      },
      {
        id: "atualizar",
        type: "button",
        grid: { x: 6, y: 9, w: 3, h: 2 },
        props: { label: "Atualizar instante", action: "run", query: "agora" },
      },
      {
        id: "baixar",
        type: "button",
        grid: { x: 9, y: 9, w: 3, h: 2 },
        props: {
          label: "Baixar Excel",
          action: "export",
          query: "acima",
          format: "xlsx",
        },
      },
    ]
    const document = {
      schemaVersion: 2,
      app: { id: appId, name: "Entradas e botões" },
      queries: [
        {
          id: "q1",
          name: "alta",
          connectionId: demoId,
          sql: "select 120 as total, 100 as anterior",
        },
        {
          id: "q2",
          name: "queda",
          connectionId: demoId,
          sql: "select 75 as total, 100 as anterior",
        },
        {
          id: "q3",
          name: "acima",
          connectionId: demoId,
          sql: "select count(*) as total from generate_series(1, 100) as n where n > :minimo",
          params: [
            { name: "minimo", type: "number", required: true, default: "90" },
          ],
        },
        {
          id: "q4",
          name: "estado",
          connectionId: demoId,
          sql: "select case when cast(:ativos as boolean) then 'só ativos' else 'todos' end as estado",
          params: [
            {
              name: "ativos",
              type: "boolean",
              required: true,
              default: "false",
            },
          ],
        },
        {
          id: "q5",
          name: "dias",
          connectionId: demoId,
          sql: "select cast(:fim as date) - cast(:inicio as date) as dias",
          params: [
            {
              name: "inicio",
              type: "date",
              required: true,
              default: "2026-01-01",
            },
            {
              name: "fim",
              type: "date",
              required: true,
              default: "2026-01-10",
            },
          ],
        },
        {
          id: "q6",
          name: "agora",
          connectionId: demoId,
          sql: "select to_char(clock_timestamp(), 'HH24:MI:SS.US') as instante",
        },
      ],
      pages: [{ id: "p1", name: "Entradas", widgets }],
    }
    expect(
      (
        await page.request.put(`/api/apps/${appId}/draft`, {
          data: { document },
        })
      ).status()
    ).toBe(200)

    await page.goto(`/apps/${appId}?mode=draft`)

    // KPI with comparison: the change and its direction (also for screen readers).
    const receita = page.getByRole("region", { name: "Receita" })
    await expect(receita).toContainText("120")
    await expect(receita).toContainText(/20%\s*de aumento/)
    const devolucoes = page.getByRole("region", { name: "Devoluções" })
    await expect(devolucoes).toContainText("75")
    await expect(devolucoes).toContainText(/-25%\s*de queda/)

    // Number input.
    const acima = page.getByRole("region", { name: "Acima do mínimo" })
    await expect(acima).toContainText("10")
    await page.getByRole("textbox", { name: "Mínimo" }).fill("95")
    await expect(acima.getByText("5", { exact: true })).toBeVisible()
    await expect(page).toHaveURL(/p\.minimo=95/)

    // Switch.
    await expect(page.getByText("Filtro: todos")).toBeVisible()
    await page.getByRole("switch", { name: "Só ativos" }).click()
    await expect(page.getByRole("switch", { name: "Só ativos" })).toBeChecked()
    await expect(page.getByText("Filtro: só ativos")).toBeVisible()

    // Date range: pick a new end date in the calendar.
    const dias = page.getByRole("region", { name: "Dias no período" })
    await expect(dias.getByText("9", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: /Período — fim/ }).click()
    const calendar = page.getByRole("dialog")
    await calendar
      .getByRole("button", { name: /20 de janeiro de 2026/ })
      .click()
    await expect(calendar).toBeHidden()
    await expect(dias.getByText("19", { exact: true })).toBeVisible()
    await expect(page).toHaveURL(/p\.fim=2026-01-20/)

    // Button "run": re-executes the query even with the same parameters.
    const instante = page.getByText(/^Instante: \d{2}:\d{2}/)
    await expect(instante).toBeVisible()
    const before = await instante.innerText()
    await page.getByRole("button", { name: "Atualizar instante" }).click()
    await expect.poll(() => instante.innerText()).not.toBe(before)

    // Button "export": downloads the query with the current parameters.
    const download = page.waitForEvent("download")
    await page.getByRole("button", { name: "Baixar Excel" }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/\.xlsx$/)
    const bytes = await readFile(await file.path())
    expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK")

    // The widget "Exportar" menu offers Excel too.
    const fromMenu = page.waitForEvent("download")
    await page
      .getByRole("button", { name: "Exportar dados de Acima do mínimo" })
      .click()
    await page.getByRole("menuitem", { name: "Exportar Excel (XLSX)" }).click()
    expect((await fromMenu).suggestedFilename()).toMatch(
      /^entradas-e-botoes-.*acima.*\.xlsx$/
    )
  })
})
