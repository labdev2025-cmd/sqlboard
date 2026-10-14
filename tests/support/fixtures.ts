import { randomUUID } from "node:crypto"

import type { Role } from "@/lib/auth/roles"
import type { CurrentUser } from "@/server/auth/session"
import { db } from "@/server/db/client"
import { user } from "@/server/db/schema"

import { TEST_ENV } from "./test-env"

export async function makeUser(
  role: Role,
  name = `${role}-${randomUUID().slice(0, 6)}`
): Promise<CurrentUser> {
  const id = randomUUID()
  const email = `${name}@exemplo.test`
  await db.insert(user).values({ id, name, email, role })
  return { id, name, email, role }
}

export const demoConnectionInput = {
  name: `Demo ${randomUUID().slice(0, 8)}`,
  dialect: "postgres" as const,
  host: TEST_ENV.DEMO_DB_HOST,
  port: Number(TEST_ENV.DEMO_DB_PORT),
  database: TEST_ENV.DEMO_DB_NAME,
  username: TEST_ENV.DEMO_DB_USER,
  password: TEST_ENV.DEMO_DB_PASSWORD,
  ssl: "disable" as const,
}
