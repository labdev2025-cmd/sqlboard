import "server-only"

import { createHash, randomBytes } from "node:crypto"

import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"

import { isRole } from "@/lib/auth/roles"
import type { CurrentUser } from "@/server/auth/session"
import { db } from "@/server/db/client"
import { apiTokens, user as userTable } from "@/server/db/schema"
import { notFound } from "@/server/http"

/** Recognizable prefix (secret scanners, logs) followed by 256 random bits. */
export const TOKEN_PREFIX = "sqlb_"

export type ApiTokenView = {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string | null
}

export const tokenInputSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome.").max(80),
  /** Days until expiry; null = never. */
  expiresInDays: z
    .union([z.literal(30), z.literal(90), z.literal(365), z.null()])
    .default(90),
})

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex")

function toView(row: typeof apiTokens.$inferSelect): ApiTokenView {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
  }
}

export async function listTokens(user: CurrentUser): Promise<ApiTokenView[]> {
  const rows = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.userId, user.id))
    .orderBy(desc(apiTokens.createdAt))
  return rows.map(toView)
}

/** Creates a token; the secret is returned only here and stored as a hash. */
export async function createToken(user: CurrentUser, raw: unknown) {
  const input = tokenInputSchema.parse(raw)
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`
  const [row] = await db
    .insert(apiTokens)
    .values({
      userId: user.id,
      name: input.name,
      tokenHash: hashToken(token),
      prefix: token.slice(0, TOKEN_PREFIX.length + 6),
      expiresAt: input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 86_400_000)
        : null,
    })
    .returning()
  return { ...toView(row!), token }
}

export async function revokeToken(user: CurrentUser, id: string) {
  if (!z.uuid().safeParse(id).success) throw notFound("Token não encontrado.")
  const deleted = await db
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, user.id)))
    .returning({ id: apiTokens.id })
  if (!deleted.length) throw notFound("Token não encontrado.")
}

/**
 * Resolves a bearer token to its user, with the role read now from the
 * database (deactivated users and expired tokens are refused).
 */
export async function userFromToken(
  token: string
): Promise<CurrentUser | null> {
  if (!token.startsWith(TOKEN_PREFIX) || token.length > 200) return null
  const [row] = await db
    .select({ token: apiTokens, user: userTable })
    .from(apiTokens)
    .innerJoin(userTable, eq(userTable.id, apiTokens.userId))
    .where(eq(apiTokens.tokenHash, hashToken(token)))
  if (!row) return null
  if (row.token.expiresAt && row.token.expiresAt.getTime() < Date.now()) {
    return null
  }
  if (row.user.disabled || !isRole(row.user.role)) return null
  // Last use with minute precision is enough (avoids a write per request).
  const last = row.token.lastUsedAt?.getTime() ?? 0
  if (Date.now() - last > 60_000) {
    await db
      .update(apiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiTokens.id, row.token.id))
  }
  return {
    id: row.user.id,
    name: row.user.name,
    email: row.user.email,
    role: row.user.role,
  }
}
