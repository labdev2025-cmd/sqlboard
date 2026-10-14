import "server-only"

import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import { db } from "@/server/db/client"
import { user as userTable } from "@/server/db/schema"

import { auth } from "./auth"
import { isRole, type Role } from "@/lib/auth/roles"

export type CurrentUser = {
  id: string
  name: string
  email: string
  role: Role
}

/**
 * Resolves the signed-in user from the request headers. The role is always
 * re-read from the database so a role change or deactivation applies at once.
 */
export async function getUserFromHeaders(
  requestHeaders: Headers,
  options: { allowToken?: boolean } = {}
): Promise<CurrentUser | null> {
  const authorization = requestHeaders.get("authorization") ?? ""
  if (/^bearer\s/i.test(authorization)) {
    // API tokens (MCP, scripts): never mixed with the cookie session.
    if (!options.allowToken) return null
    const { userFromToken } = await import("@/server/services/api-tokens")
    return userFromToken(authorization.replace(/^bearer\s+/i, "").trim())
  }
  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session) return null
  const [row] = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      role: userTable.role,
      disabled: userTable.disabled,
    })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
  if (!row || row.disabled || !isRole(row.role)) return null
  return { id: row.id, name: row.name, email: row.email, role: row.role }
}

/** Current user for Server Components (memoized per request). */
export const getCurrentUser = cache(async () =>
  getUserFromHeaders(await headers())
)

/** Redirects to the login page when there is no session. */
export async function requireUser(): Promise<CurrentUser> {
  const current = await getCurrentUser()
  if (!current) redirect("/login")
  return current
}
