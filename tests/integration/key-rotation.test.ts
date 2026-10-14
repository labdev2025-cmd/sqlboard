import { randomBytes } from "node:crypto"

import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { reencryptConnectionSecrets } from "@/server/crypto/rotate"
import {
  decryptSecret,
  encryptSecret,
  keyRingFromEnv,
  secretKeyVersion,
} from "@/server/crypto/secrets"
import { db } from "@/server/db/client"
import { connections } from "@/server/db/schema"

class Rollback extends Error {}

describe("rotação da chave das senhas de conexão", () => {
  it("recifra com a versão atual e é idempotente", async () => {
    // Current test key becomes "old" version 1; everything happens inside a
    // transaction that is rolled back, so other tests keep their key.
    const oldKey = process.env.SQLBOARD_ENCRYPTION_KEY!
    const newKey = randomBytes(32).toString("base64")
    const ring = keyRingFromEnv({
      SQLBOARD_ENCRYPTION_KEY: newKey,
      SQLBOARD_ENCRYPTION_KEY_VERSION: "2",
      SQLBOARD_ENCRYPTION_OLD_KEYS: `1:${oldKey}`,
    })
    await expect(
      db.transaction(async (tx) => {
        const [row] = await tx
          .insert(connections)
          .values({
            name: `Rotação ${Date.now()}`,
            dialect: "postgres",
            host: "localhost",
            database: "x",
            username: "u",
            passwordEnc: encryptSecret(
              "senha-ficticia",
              keyRingFromEnv({ SQLBOARD_ENCRYPTION_KEY: oldKey })
            ),
          })
          .returning({ id: connections.id })
        const first = await reencryptConnectionSecrets(tx as never, ring)
        expect(first.updated).toBe(first.total)
        const read = async () =>
          (
            await tx
              .select({ passwordEnc: connections.passwordEnc })
              .from(connections)
              .where(eq(connections.id, row!.id))
          )[0]!.passwordEnc!
        const rotated = await read()
        expect(secretKeyVersion(rotated)).toBe(2)
        // Readable with the new key alone: the old key can be removed.
        expect(
          decryptSecret(
            rotated,
            keyRingFromEnv({
              SQLBOARD_ENCRYPTION_KEY: newKey,
              SQLBOARD_ENCRYPTION_KEY_VERSION: "2",
            })
          )
        ).toBe("senha-ficticia")
        const again = await reencryptConnectionSecrets(tx as never, ring)
        expect(again.updated).toBe(0)
        expect(await read()).toBe(rotated)
        throw new Rollback()
      })
    ).rejects.toBeInstanceOf(Rollback)
  })
})
