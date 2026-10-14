import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

/**
 * AES-256-GCM envelope for connection secrets.
 *
 * Format (text, safe to store in a column): `v1:<keyVersion>:<iv>:<tag>:<ciphertext>`,
 * each binary part in base64url. The IV is 12 random bytes per secret and the
 * authentication tag detects tampering.
 */

const ALGORITHM = "aes-256-gcm"
const IV_BYTES = 12
const KEY_BYTES = 32
const FORMAT = "v1"

export type KeyRing = {
  currentVersion: number
  keys: Map<number, Buffer>
}

export class SecretError extends Error {}

function decodeKey(value: string, label: string): Buffer {
  const key = Buffer.from(value.trim(), "base64")
  if (key.length !== KEY_BYTES) {
    throw new SecretError(
      `${label} precisa ter ${KEY_BYTES} bytes em base64 (gere com: openssl rand -base64 32).`
    )
  }
  return key
}

/** Builds the key ring from environment variables (see .env.example). */
export function keyRingFromEnv(
  env: Record<string, string | undefined> = process.env
): KeyRing {
  const current = env.SQLBOARD_ENCRYPTION_KEY
  if (!current) {
    throw new SecretError(
      "SQLBOARD_ENCRYPTION_KEY não definida. Veja .env.example."
    )
  }
  const currentVersion = Number(env.SQLBOARD_ENCRYPTION_KEY_VERSION ?? "1")
  if (!Number.isInteger(currentVersion) || currentVersion < 1) {
    throw new SecretError(
      "SQLBOARD_ENCRYPTION_KEY_VERSION deve ser um inteiro >= 1."
    )
  }
  const keys = new Map<number, Buffer>()
  for (const entry of (env.SQLBOARD_ENCRYPTION_OLD_KEYS ?? "").split(",")) {
    if (!entry.trim()) continue
    const [version, value] = entry.split(":")
    keys.set(Number(version), decodeKey(value ?? "", `Chave antiga ${version}`))
  }
  keys.set(currentVersion, decodeKey(current, "SQLBOARD_ENCRYPTION_KEY"))
  return { currentVersion, keys }
}

export function encryptSecret(plaintext: string, ring: KeyRing): string {
  const key = ring.keys.get(ring.currentVersion)
  if (!key) throw new SecretError("Chave atual ausente no chaveiro.")
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [
    FORMAT,
    String(ring.currentVersion),
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":")
}

export function decryptSecret(envelope: string, ring: KeyRing): string {
  const parts = envelope.split(":")
  if (parts.length !== 5 || parts[0] !== FORMAT) {
    throw new SecretError("Segredo em formato desconhecido.")
  }
  const [, versionText, ivText, tagText, dataText] = parts
  const key = ring.keys.get(Number(versionText))
  if (!key) {
    throw new SecretError(
      `Chave de versão ${versionText} indisponível para decifrar o segredo.`
    )
  }
  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivText, "base64url")
    )
    decipher.setAuthTag(Buffer.from(tagText, "base64url"))
    return Buffer.concat([
      decipher.update(Buffer.from(dataText, "base64url")),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    throw new SecretError(
      "Não foi possível decifrar o segredo (chave errada ou dado adulterado)."
    )
  }
}

export function secretKeyVersion(envelope: string): number | null {
  const parts = envelope.split(":")
  return parts.length === 5 ? Number(parts[1]) : null
}

let cachedRing: KeyRing | null = null

/** Key ring from the process environment, cached after the first use. */
export function getKeyRing(): KeyRing {
  cachedRing ??= keyRingFromEnv()
  return cachedRing
}
