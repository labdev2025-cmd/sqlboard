import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import * as schema from "./schema"

declare global {
  var __sqlboardMetaPool: Pool | undefined
}

/**
 * Metadata pool, reused across hot reloads in development. The pool only
 * connects on the first query, so importing this module during `next build`
 * does not require a database.
 */
export const metaPool: Pool = (globalThis.__sqlboardMetaPool ??= new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
}))

export const db = drizzle(metaPool, { schema })

export type Db = typeof db
