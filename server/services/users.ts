import "server-only"

import { asc, count, eq } from "drizzle-orm"

import { auth } from "@/server/auth/auth"
import type { Role } from "@/lib/auth/roles"
import { db } from "@/server/db/client"
import { session, user } from "@/server/db/schema"
import { badRequest, notFound } from "@/server/http"

export async function hasAnyUser(): Promise<boolean> {
  const [row] = await db.select({ value: count() }).from(user)
  return (row?.value ?? 0) > 0
}

export async function listUsers() {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      disabled: user.disabled,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(asc(user.name))
}

/**
 * Creates an account on behalf of an admin. Public sign-up is closed after the
 * first admin, so this uses Better Auth's internal adapter (same path its admin
 * plugin uses) to create the user and its credential account.
 */
export async function createUserAccount(input: {
  name: string
  email: string
  password: string
  role: Role
}) {
  const ctx = await auth.$context
  const email = input.email.trim().toLowerCase()
  if (await ctx.internalAdapter.findUserByEmail(email)) {
    throw badRequest("Já existe um usuário com esse e-mail.")
  }
  if (input.password.length < 8) {
    throw badRequest("A senha precisa ter pelo menos 8 caracteres.")
  }
  const created = await ctx.internalAdapter.createUser(
    {
      name: input.name.trim(),
      email,
      emailVerified: false,
      role: input.role,
    },
    { method: "admin" }
  )
  const hash = await ctx.password.hash(input.password)
  await ctx.internalAdapter.linkAccount({
    providerId: "credential",
    accountId: created.id,
    password: hash,
    userId: created.id,
  })
  // The create hook only trusts known roles; enforce the chosen one.
  await db.update(user).set({ role: input.role }).where(eq(user.id, created.id))
  return { id: created.id }
}

export async function updateUserAccount(
  id: string,
  changes: { role?: Role; disabled?: boolean; name?: string },
  actingUserId: string
) {
  const [existing] = await db.select().from(user).where(eq(user.id, id))
  if (!existing) throw notFound("Usuário não encontrado.")
  if (id === actingUserId && changes.role && changes.role !== "admin") {
    throw badRequest("Você não pode remover o próprio papel de administrador.")
  }
  if (id === actingUserId && changes.disabled) {
    throw badRequest("Você não pode desativar a própria conta.")
  }
  await db
    .update(user)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(user.id, id))
  if (changes.disabled) {
    await db.delete(session).where(eq(session.userId, id))
  }
}

export async function resetUserPassword(id: string, password: string) {
  if (password.length < 8) {
    throw badRequest("A senha precisa ter pelo menos 8 caracteres.")
  }
  const ctx = await auth.$context
  const hash = await ctx.password.hash(password)
  await ctx.internalAdapter.updatePassword(id, hash)
  await db.delete(session).where(eq(session.userId, id))
}
