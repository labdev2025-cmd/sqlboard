// Starts the standalone production server produced by `next build`
// (output: "standalone"), copying the static assets it expects next to it.
import { spawn } from "node:child_process"
import { cpSync, existsSync } from "node:fs"
import path from "node:path"

import "dotenv/config"

const root = path.resolve(import.meta.dirname, "..")
const standalone = path.join(root, ".next", "standalone")
if (!existsSync(path.join(standalone, "server.js"))) {
  console.error("Build não encontrado. Rode `pnpm build` antes.")
  process.exit(1)
}
cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), {
  recursive: true,
})
if (existsSync(path.join(root, "public"))) {
  cpSync(path.join(root, "public"), path.join(standalone, "public"), {
    recursive: true,
  })
}

const port = process.argv.includes("-p")
  ? process.argv[process.argv.indexOf("-p") + 1]
  : (process.env.PORT ?? "3000")

// The standalone server.js changes into its own directory, so relative data
// paths are resolved here, against the project root.
const dataPaths = {}
for (const key of ["SQLBOARD_SQLITE_DIR", "SQLBOARD_OUTBOX_DIR"]) {
  dataPaths[key] = path.resolve(
    root,
    process.env[key] ?? (key === "SQLBOARD_SQLITE_DIR" ? "data/sqlite" : ".data/outbox")
  )
}

const child = spawn(process.execPath, [path.join(standalone, "server.js")], {
  stdio: "inherit",
  env: {
    ...process.env,
    ...dataPaths,
    PORT: port,
    HOSTNAME: process.env.HOSTNAME ?? "0.0.0.0",
  },
})
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal))
}
child.on("exit", (code) => process.exit(code ?? 0))
