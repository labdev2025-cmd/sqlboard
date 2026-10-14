import { describe, expect, it } from "vitest"

import {
  decryptSecret,
  encryptSecret,
  keyRingFromEnv,
  secretKeyVersion,
  SecretError,
} from "@/server/crypto/secrets"

const KEY_A = Buffer.alloc(32, 1).toString("base64")
const KEY_B = Buffer.alloc(32, 2).toString("base64")

function ring(version = 1, oldKeys = "") {
  return keyRingFromEnv({
    SQLBOARD_ENCRYPTION_KEY: version === 1 ? KEY_A : KEY_B,
    SQLBOARD_ENCRYPTION_KEY_VERSION: String(version),
    SQLBOARD_ENCRYPTION_OLD_KEYS: oldKeys,
  })
}

describe("segredos AES-256-GCM", () => {
  it("cifra e decifra (ida e volta), inclusive acentos", () => {
    const envelope = encryptSecret("s3nh@ çãõ", ring())
    expect(envelope).not.toContain("s3nh@")
    expect(decryptSecret(envelope, ring())).toBe("s3nh@ çãõ")
  })

  it("usa IV único por segredo", () => {
    const a = encryptSecret("mesma senha", ring())
    const b = encryptSecret("mesma senha", ring())
    expect(a).not.toBe(b)
    expect(a.split(":")[2]).not.toBe(b.split(":")[2])
    expect(Buffer.from(a.split(":")[2], "base64url")).toHaveLength(12)
  })

  it("detecta adulteração do texto cifrado", () => {
    const parts = encryptSecret("senha", ring()).split(":")
    const data = Buffer.from(parts[4], "base64url")
    data[0] ^= 0xff
    parts[4] = data.toString("base64url")
    expect(() => decryptSecret(parts.join(":"), ring())).toThrow(SecretError)
  })

  it("detecta adulteração do auth tag", () => {
    const parts = encryptSecret("senha", ring()).split(":")
    const tag = Buffer.from(parts[3], "base64url")
    tag[0] ^= 0x01
    parts[3] = tag.toString("base64url")
    expect(() => decryptSecret(parts.join(":"), ring())).toThrow(SecretError)
  })

  it("rejeita chave errada", () => {
    const envelope = encryptSecret("senha", ring())
    const other = keyRingFromEnv({
      SQLBOARD_ENCRYPTION_KEY: KEY_B,
    })
    expect(() => decryptSecret(envelope, other)).toThrow(SecretError)
  })

  it("rotaciona chaves com keyVersion", () => {
    const old = encryptSecret("antiga", ring(1))
    const rotated = ring(2, `1:${KEY_A}`)
    expect(secretKeyVersion(old)).toBe(1)
    expect(decryptSecret(old, rotated)).toBe("antiga")
    const fresh = encryptSecret("nova", rotated)
    expect(secretKeyVersion(fresh)).toBe(2)
  })

  it("exige chave de 32 bytes", () => {
    expect(() =>
      keyRingFromEnv({
        SQLBOARD_ENCRYPTION_KEY: Buffer.alloc(16).toString("base64"),
      })
    ).toThrow(/32 bytes/)
    expect(() => keyRingFromEnv({})).toThrow(SecretError)
  })
})
