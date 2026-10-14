import path from "node:path"

import { migrate } from "drizzle-orm/node-postgres/migrator"

import { db } from "@/server/db/client"

/**
 * Runs once per server process (instrumentation.ts). The production image sets
 * SQLBOARD_MIGRATE_ON_BOOT=on so a fresh container migrates its own database.
 */
export async function onServerStart() {
  if (process.env.SQLBOARD_MIGRATE_ON_BOOT === "on") {
    await migrate(db, {
      migrationsFolder: path.join(process.cwd(), "server/db/migrations"),
    })
    console.log("[sqlboard] migrações aplicadas")
  }
}
