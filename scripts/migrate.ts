import "dotenv/config"

import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"

/** Applies the versioned Drizzle migrations to DATABASE_URL. */
async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL não definida.")
  const pool = new Pool({ connectionString: url, max: 1 })
  try {
    await migrate(drizzle(pool), { migrationsFolder: "server/db/migrations" })
    console.log("Migrações aplicadas.")
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
