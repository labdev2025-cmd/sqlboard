import { expect, test } from "@playwright/test"

import { storageFor } from "./support/helpers"

test.describe("outros bancos (SQLite)", () => {
  test.use({ storageState: storageFor("admin") })

  test("cadastra SQLite, executa com parâmetro e bloqueia escrita", async ({
    page,
  }) => {
    await page.goto("/connections/new")
    await page.getByLabel("Nome", { exact: true }).fill("Loja SQLite")
    await page.getByRole("combobox", { name: "Banco", exact: true }).click()
    await page.getByRole("option", { name: "SQLite" }).click()
    await expect(page.getByLabel("Host")).toHaveCount(0)

    // Files outside SQLBOARD_SQLITE_DIR are refused.
    await page.getByLabel("Arquivo do banco").fill("../../etc/passwd")
    await page.getByRole("button", { name: "Testar conexão" }).click()
    await expect(page.getByText("Falha ao conectar").first()).toBeVisible()
    await expect(
      page.getByText(/O arquivo SQLite precisa ficar dentro de/)
    ).toBeVisible()

    await page.getByLabel("Arquivo do banco").fill("loja.db")
    await page.getByRole("button", { name: "Testar conexão" }).click()
    await expect(page.getByText("Conexão bem-sucedida").first()).toBeVisible()
    await page.getByRole("button", { name: "Salvar" }).click()
    await expect(page).toHaveURL(/\/connections\/[0-9a-f-]{36}$/)
    const connectionId = page.url().split("/").pop()!

    const run = (sql: string, values: Record<string, string> = {}) =>
      page.request.post("/api/execute", {
        data: {
          connectionId,
          sql,
          values,
          params: Object.keys(values).map((name) => ({ name, type: "text" })),
        },
      })
    const ok = await run(
      "select uf, count(*) as total from clientes where uf = :uf group by uf",
      { uf: "CE' or '1'='1" }
    )
    expect(ok.status()).toBe(200)
    // The injection attempt is a plain value: no state matches it.
    expect((await ok.json()).rowCount).toBe(0)

    const ce = await run(
      "select uf, count(*) as total from clientes where uf = :uf group by uf",
      { uf: "CE" }
    )
    const body = await ce.json()
    expect(body.rows[0][0]).toBe("CE")
    expect(body.columns.map((c: { name: string }) => c.name)).toEqual([
      "uf",
      "total",
    ])

    const write = await run("delete from clientes")
    expect(write.status()).toBe(400)
    expect(JSON.stringify(await write.json())).toMatch(/leitura/i)
  })
})
