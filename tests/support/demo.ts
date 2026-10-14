import type { ConnectionConfig } from "@/server/datasources/types"

import { TEST_ENV } from "./test-env"

/** Read-only demo user (the recommended production setup). */
export function demoConfig(
  overrides: Partial<ConnectionConfig> = {}
): ConnectionConfig {
  return {
    key: `demo-${Math.random()}`,
    dialect: "postgres",
    host: TEST_ENV.DEMO_DB_HOST,
    port: Number(TEST_ENV.DEMO_DB_PORT),
    database: TEST_ENV.DEMO_DB_NAME,
    username: TEST_ENV.DEMO_DB_USER,
    password: TEST_ENV.DEMO_DB_PASSWORD,
    ssl: "disable",
    statementTimeoutMs: 30_000,
    ...overrides,
  }
}

/** Owner of the demo schema: proves READ ONLY blocks writes even with privileges. */
export function ownerConfig(): ConnectionConfig {
  const url = new URL(TEST_ENV.DATABASE_URL)
  return demoConfig({
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  })
}
