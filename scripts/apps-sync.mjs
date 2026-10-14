// Versiona telas do sqlboard em git: baixa (pull) cada tela que você edita
// como JSON estável e envia (push) os arquivos de volta como rascunho.
//
//   SQLBOARD_URL=https://sqlboard.exemplo.com SQLBOARD_TOKEN=sqlb_... \
//     node scripts/apps-sync.mjs pull apps/
//   node scripts/apps-sync.mjs push apps/
//
// O token é criado em /settings/tokens. Push nunca publica: revise o
// rascunho na tela e publique por lá.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const [command, dirArg = "apps"] = process.argv.slice(2)
const base = (process.env.SQLBOARD_URL ?? "http://localhost:3000").replace(/\/$/, "")
const token = process.env.SQLBOARD_TOKEN
const dir = path.resolve(dirArg)

if (!["pull", "push"].includes(command ?? "") || !token) {
  console.error(
    "Uso: SQLBOARD_URL=… SQLBOARD_TOKEN=sqlb_… node scripts/apps-sync.mjs <pull|push> [pasta]"
  )
  process.exit(2)
}

async function call(url, init = {}) {
  const response = await fetch(`${base}${url}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const error = new Error(body.error ?? `HTTP ${response.status}`)
    error.details = body.details
    throw error
  }
  return response
}

async function editableApps() {
  const apps = await (await call("/api/apps?scope=all")).json()
  return apps.filter((app) => app.canEdit)
}

async function pull() {
  await mkdir(dir, { recursive: true })
  for (const app of await editableApps()) {
    const response = await call(`/api/apps/${app.id}/file`)
    const name =
      /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ??
      `${app.id}.sqlboard.json`
    const file = JSON.parse(await response.text())
    // exportedAt changes on every pull; leave it out so git only sees real edits.
    delete file.exportedAt
    await writeFile(path.join(dir, name), `${JSON.stringify(sortKeys(file), null, 2)}\n`)
    console.log(`↓ ${app.name} → ${name}`)
  }
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys(value[key])])
    )
  }
  return value
}

async function push() {
  const editable = new Set((await editableApps()).map((app) => app.id))
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort()
  let failed = 0
  for (const name of files) {
    const file = JSON.parse(await readFile(path.join(dir, name), "utf8"))
    const id = file?.document?.app?.id ?? file?.app?.id
    const targetAppId = editable.has(id) ? id : undefined
    try {
      const result = await (
        await call("/api/apps/import", {
          method: "POST",
          body: JSON.stringify({ file, targetAppId }),
        })
      ).json()
      console.log(`↑ ${name} → ${result.created ? "nova tela" : "rascunho atualizado"} (${result.id})`)
    } catch (error) {
      failed++
      console.error(`✗ ${name}: ${error.message}`)
      if (error.details) console.error(JSON.stringify(error.details, null, 2))
    }
  }
  if (failed) process.exit(1)
}

await (command === "pull" ? pull() : push())
