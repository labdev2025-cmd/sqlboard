import "dotenv/config"

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { reencryptConnectionSecrets } from "../server/crypto/rotate"
import { keyRingFromEnv } from "../server/crypto/secrets"

/**
 * Rotação da chave das senhas de conexão:
 *   1. SQLBOARD_ENCRYPTION_OLD_KEYS="1:<chave antiga>", nova chave em
 *      SQLBOARD_ENCRYPTION_KEY e SQLBOARD_ENCRYPTION_KEY_VERSION=2;
 *   2. pnpm keys:rotate (recifra tudo com a versão atual);
 *   3. remova a chave antiga de SQLBOARD_ENCRYPTION_OLD_KEYS.
 */
async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL não definida.")
  const pool = new Pool({ connectionString: url, max: 1 })
  try {
    const result = await reencryptConnectionSecrets(
      drizzle(pool),
      keyRingFromEnv()
    )
    console.log(
      `Senhas recifradas: ${result.updated} de ${result.total} (as demais já estavam na versão atual).`
    )
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
