import "dotenv/config"

import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { encryptSecret, keyRingFromEnv } from "../server/crypto/secrets"
import { connections } from "../server/db/schema"

/**
 * Development seed: creates (or refreshes) the "Demo" connection to the
 * fictitious store database, using its read-only user.
 */
async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL não definida.")
  const pool = new Pool({ connectionString: url, max: 1 })
  const db = drizzle(pool)
  try {
    const ring = keyRingFromEnv()
    const values = {
      name: "Demo",
      description:
        "Loja fictícia (clientes, produtos, pedidos) para testar o sqlboard.",
      dialect: "postgres",
      host: process.env.DEMO_DB_HOST ?? "localhost",
      port: Number(process.env.DEMO_DB_PORT ?? 5432),
      database: process.env.DEMO_DB_NAME ?? "sqlboard_demo",
      username: process.env.DEMO_DB_USER ?? "sqlboard_demo_ro",
      passwordEnc: encryptSecret(
        process.env.DEMO_DB_PASSWORD ?? "demo_ro_local",
        ring
      ),
      ssl: "disable",
      isDemo: true,
      updatedAt: new Date(),
    }
    const [existing] = await db
      .select({ id: connections.id })
      .from(connections)
      .where(eq(connections.name, "Demo"))
    if (existing) {
      await db
        .update(connections)
        .set({ ...values, schemaCache: null, schemaCachedAt: null })
        .where(eq(connections.id, existing.id))
      console.log("Conexão Demo atualizada.")
    } else {
      await db.insert(connections).values(values)
      console.log("Conexão Demo criada.")
    }
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
