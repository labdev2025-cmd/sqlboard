import { execFileSync } from "node:child_process"

import { Client } from "pg"

import { E2E_DB_ADMIN_URL, E2E_ENV } from "./env"

/** Recreates the e2e metadata database, migrates it and seeds the demo connection. */
export default async function globalSetup() {
  const client = new Client({ connectionString: E2E_DB_ADMIN_URL })
  await client.connect()
  try {
    await client.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'sqlboard_e2e' AND pid <> pg_backend_pid()"
    )
    await client.query("DROP DATABASE IF EXISTS sqlboard_e2e")
    await client.query("CREATE DATABASE sqlboard_e2e")
  } finally {
    await client.end()
  }
  const env = { ...process.env, ...E2E_ENV }
  execFileSync("pnpm", ["--silent", "db:migrate"], { env, stdio: "inherit" })
  execFileSync("pnpm", ["--silent", "db:seed"], { env, stdio: "inherit" })
}
