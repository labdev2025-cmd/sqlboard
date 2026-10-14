import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"

import { TEST_ENV } from "./test-env"

/** Recreates the test metadata schema once per run and applies migrations. */
export default async function setup() {
  const pool = new Pool({ connectionString: TEST_ENV.DATABASE_URL, max: 1 })
  try {
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE")
    await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE")
    await pool.query("CREATE SCHEMA public")
    await migrate(drizzle(pool), { migrationsFolder: "server/db/migrations" })
  } finally {
    await pool.end()
  }
}
