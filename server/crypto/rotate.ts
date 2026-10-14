import { eq, isNotNull } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"

import { connections } from "../db/schema"

import {
  decryptSecret,
  encryptSecret,
  secretKeyVersion,
  type KeyRing,
} from "./secrets"

/**
 * Re-encrypts every stored connection password with the current key
 * version (after SQLBOARD_ENCRYPTION_KEY rotation). Idempotent: passwords
 * already on the current version are left alone.
 */
export async function reencryptConnectionSecrets(
  db: NodePgDatabase<Record<string, unknown>>,
  ring: KeyRing
) {
  const rows = await db
    .select({ id: connections.id, passwordEnc: connections.passwordEnc })
    .from(connections)
    .where(isNotNull(connections.passwordEnc))
  let updated = 0
  for (const row of rows) {
    if (secretKeyVersion(row.passwordEnc!) === ring.currentVersion) continue
    const plain = decryptSecret(row.passwordEnc!, ring)
    await db
      .update(connections)
      .set({ passwordEnc: encryptSecret(plain, ring) })
      .where(eq(connections.id, row.id))
    updated++
  }
  return { total: rows.length, updated }
}
