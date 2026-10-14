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
})
