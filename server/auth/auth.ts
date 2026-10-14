import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { nextCookies } from "better-auth/next-js"
import { count, eq } from "drizzle-orm"

import { db } from "@/server/db/client"
import * as schema from "@/server/db/schema"

import { ROLES } from "@/lib/auth/roles"

async function userCount() {
  const [row] = await db.select({ value: count() }).from(schema.user)
  return row?.value ?? 0
}

export const auth = betterAuth({
  appName: "sqlboard",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "viewer",
        input: false,
      },
      disabled: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
  rateLimit: {
    // Brute-force protection on auth endpoints; e2e runs disable it because
    // every test signs in from the same address.
    enabled: process.env.SQLBOARD_AUTH_RATE_LIMIT !== "off",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  databaseHooks: {
    user: {
      create: {
        // The very first account becomes admin; every later one keeps the
        // role chosen by the admin who created it (default: viewer).
        before: async (data) => {
          const first = (await userCount()) === 0
          const requested = (data as { role?: string }).role
          const role = first
            ? "admin"
            : ROLES.includes(requested as never)
              ? requested
              : "viewer"
          return { data: { ...data, role } }
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const [row] = await db
            .select({ disabled: schema.user.disabled })
            .from(schema.user)
            .where(eq(schema.user.id, session.userId))
          if (row?.disabled) {
            throw new APIError("FORBIDDEN", {
              message: "Usuário desativado. Fale com um administrador.",
            })
          }
          return { data: session }
        },
      },
    },
  },
  hooks: {
    // Public sign-up only exists to create the first admin. Later accounts
    // are created by an admin (server/services/users.ts).
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email" && (await userCount()) > 0) {
        throw new APIError("FORBIDDEN", {
          message:
            "Cadastro fechado. Peça a um administrador para criar sua conta.",
        })
      }
    }),
  },
  plugins: [nextCookies()],
})

export type Session = typeof auth.$Infer.Session
