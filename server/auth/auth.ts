import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { nextCookies } from "better-auth/next-js"
import { count, eq, sql } from "drizzle-orm"

import { db } from "@/server/db/client"
import * as schema from "@/server/db/schema"

import { ROLES } from "@/lib/auth/roles"

function list(value: string | undefined) {
  const items = (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  return items.length ? items : undefined
}

/**
 * Per-account limit (on top of the per-IP one): 20 failed sign-ins per
 * 15 min. Only failures count and a successful sign-in clears the counter,
 * so requests with a known e-mail alone cannot keep the owner locked out.
 */
const ACCOUNT_WINDOW_MS = 15 * 60_000
const ACCOUNT_MAX_FAILURES = 20

const accountKey = (email: string) => `account:${email.trim().toLowerCase()}`

async function failuresForAccount(email: string) {
  const result = await db.execute<{ count: number }>(sql`
    select count from rate_limit
    where key = ${accountKey(email)}
      and last_request >= ${Date.now() - ACCOUNT_WINDOW_MS}`)
  return Number(result.rows[0]?.count ?? 0)
}

async function recordAccountFailure(email: string) {
  const now = Date.now()
  await db.execute(sql`
    insert into rate_limit (id, key, count, last_request)
    values (${crypto.randomUUID()}, ${accountKey(email)}, 1, ${now})
    on conflict (key) do update set
      count = case when rate_limit.last_request < ${now - ACCOUNT_WINDOW_MS}
        then 1 else rate_limit.count + 1 end,
      last_request = case when rate_limit.last_request < ${now - ACCOUNT_WINDOW_MS}
        then ${now} else rate_limit.last_request end`)
}

async function clearAccountFailures(email: string) {
  await db.execute(sql`delete from rate_limit where key = ${accountKey(email)}`)
}

const accountLimitEnabled = () => process.env.SQLBOARD_AUTH_RATE_LIMIT !== "off"

async function claimBootstrapAdmin() {
  const claimed = await db
    .insert(schema.settings)
    .values({ key: "bootstrap.admin", value: new Date().toISOString() })
    .onConflictDoNothing()
    .returning({ key: schema.settings.key })
  return claimed.length > 0
}

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
      rateLimit: schema.rateLimit,
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
    // In the metadata database: survives restarts and is shared by replicas.
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
  advanced: {
    ipAddress: {
      // Header the reverse proxy sets (and overwrites) with the client IP,
      // and the proxies allowed in a forwarded chain. See docs/DEPLOY.md.
      ipAddressHeaders: list(process.env.SQLBOARD_IP_HEADERS) ?? [
        "x-forwarded-for",
      ],
      trustedProxies: list(process.env.SQLBOARD_TRUSTED_PROXIES),
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
          // Two simultaneous first sign-ups: only the one that claims the
          // bootstrap marker (atomic insert) becomes admin.
          const first =
            (await userCount()) === 0 && (await claimBootstrapAdmin())
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
      if (ctx.path === "/sign-in/email" && accountLimitEnabled()) {
        const email = String((ctx.body as { email?: unknown })?.email ?? "")
        if (
          email &&
          (await failuresForAccount(email)) >= ACCOUNT_MAX_FAILURES
        ) {
          throw new APIError("TOO_MANY_REQUESTS", {
            message:
              "Muitas tentativas para esta conta. Aguarde alguns minutos e tente de novo.",
          })
        }
      }
      if (ctx.path === "/sign-up/email" && (await userCount()) > 0) {
        throw new APIError("FORBIDDEN", {
          message:
            "Cadastro fechado. Peça a um administrador para criar sua conta.",
        })
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email" || !accountLimitEnabled()) return
      const email = String((ctx.body as { email?: unknown })?.email ?? "")
      if (!email) return
      const returned = ctx.context.returned
      if (!(returned instanceof APIError)) await clearAccountFailures(email)
      else if (returned.statusCode === 401) await recordAccountFailure(email)
    }),
  },
  plugins: [nextCookies()],
})

export type Session = typeof auth.$Infer.Session
