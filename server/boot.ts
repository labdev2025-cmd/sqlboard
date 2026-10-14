import path from "node:path"

import { migrate } from "drizzle-orm/node-postgres/migrator"

import { db } from "@/server/db/client"

/**
 * Runs once per server process (instrumentation.ts). The production image sets
 * SQLBOARD_MIGRATE_ON_BOOT=on so a fresh container migrates its own database.
 */
/** Values copied from .env.example must never reach production. */
function assertRealSecrets() {
  if (process.env.NODE_ENV !== "production") return
  const authSecret = process.env.BETTER_AUTH_SECRET ?? ""
  const key = Buffer.from(process.env.SQLBOARD_ENCRYPTION_KEY ?? "", "base64")
  const problems = [
    authSecret.length < 32 || /troque/i.test(authSecret)
      ? "BETTER_AUTH_SECRET"
      : null,
    key.length === 32 && key.every((byte) => byte === 0)
      ? "SQLBOARD_ENCRYPTION_KEY"
      : null,
  ].filter(Boolean)
  if (problems.length) {
    throw new Error(
      `[sqlboard] ${problems.join(" e ")} ainda com o valor de exemplo (ou curto demais). Gere com: openssl rand -base64 32`
    )
  }
}

export async function onServerStart() {
  assertRealSecrets()
  if (process.env.SQLBOARD_MIGRATE_ON_BOOT === "on") {
    await migrate(db, {
      migrationsFolder: path.join(process.cwd(), "server/db/migrations"),
    })
    console.log("[sqlboard] migrações aplicadas")
  }
  const { startScheduler } = await import("@/server/services/schedules")
  startScheduler()
}
