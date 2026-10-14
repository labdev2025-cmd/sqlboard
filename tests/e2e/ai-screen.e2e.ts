import { expect, test } from "@playwright/test"

import { expectAccessible, grantDemo, storageFor } from "./support/helpers"

test.describe("gerar tela com IA", () => {
  test.use({ storageState: storageFor("editor") })

  test("monta o prompt, valida e aplica a resposta colada", async ({
    page,
    browser,
  }, info) => {
    const demoId = await grantDemo(browser, info.project.use.baseURL!, "editor")
    const created = await page.request.post("/api/apps", {
      data: { name: "Tela gerada por IA" },
    })
    const appId = (await created.json()).id
    await page.goto(`/apps/${appId}/edit`)
    await page.getByRole("button", { name: "Gerar com IA" }).click()
    const dialog = page.getByRole("dialog", { name: "Gerar tela com IA" })
    await dialog
      .getByLabel("1. O que a tela deve mostrar?")
      .fill("Clientes por UF com filtro de segmento")
    await dialog.getByRole("combobox", { name: "Conexão" }).click()
    await page.getByRole("option", { name: "Demo" }).click()
    await dialog.getByRole("button", { name: "Montar prompt" }).click()
    const prompt = dialog.getByLabel("Prompt")
    await expect(prompt).toHaveValue(/connectionId a usar: /)
    await expect(prompt).toHaveValue(/loja\.clientes/)
    await expectAccessible(page)

    // An invalid answer is explained, nothing changes.
    await dialog.getByLabel("2. Resposta da IA").fill("```json\n{}\n```")
    await dialog.getByRole("button", { name: "Aplicar ao rascunho" }).click()
    await expect(dialog.getByRole("alert")).toContainText("não segue o formato")

    const answer = {
      schemaVersion: 2,
      app: { id: "qualquer", name: "Tela gerada por IA" },
      queries: [
        {
          id: "q1",
          name: "clientes_uf",
          connectionId: demoId,
          sql: "select uf, count(*) as total from loja.clientes where segmento = :segmento group by uf order by uf",
          params: [{ name: "segmento", type: "text", default: "Varejo" }],
        },
      ],
      pages: [
        {
          id: "p1",
          name: "Visão geral",
          widgets: [
            {
              id: "segmento",
              type: "text-input",
              grid: { x: 0, y: 0, w: 4, h: 3 },
              props: { label: "Segmento", param: "segmento" },
              bindings: {},
            },
            {
              id: "grafico",
              type: "bar-chart",
              grid: { x: 0, y: 3, w: 12, h: 8 },
              props: { title: "Clientes por UF", x: "uf", y: ["total"] },
              bindings: { data: "{{clientes_uf.data}}" },
            },
          ],
        },
      ],
    }
    await dialog
      .getByLabel("2. Resposta da IA")
      .fill(`Pronto:\n\`\`\`json\n${JSON.stringify(answer)}\n\`\`\``)
    await dialog.getByRole("button", { name: "Aplicar ao rascunho" }).click()
    await expect(
      page.getByText("Tela gerada aplicada ao rascunho").first()
    ).toBeVisible()
    await expect(page.getByRole("tab", { name: "Visão geral" })).toBeVisible()
    await expect(page.getByText("Clientes por UF").first()).toBeVisible()
    // Undo brings the empty screen back.
    await page.getByRole("button", { name: "Desfazer" }).click()
    await expect(page.getByRole("tab", { name: "Visão geral" })).toHaveCount(0)
  })
})
