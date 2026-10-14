/** Environment of the server used by the e2e tests (fictitious values). */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100)

const base =
  process.env.E2E_DATABASE_BASE ?? "postgres://sqlboard:sqlboard@localhost:5432"

export const E2E_ENV: Record<string, string> = {
  DATABASE_URL: `${base}/sqlboard_e2e`,
  BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-1234",
  BETTER_AUTH_URL: `http://localhost:${E2E_PORT}`,
  SQLBOARD_ENCRYPTION_KEY: "ZTJlLWtleS1lMmUta2V5LWUyZS1rZXktMzJieXRlcyE=",
  SQLBOARD_ENCRYPTION_KEY_VERSION: "1",
  DEMO_DB_HOST: process.env.DEMO_DB_HOST ?? "localhost",
  DEMO_DB_PORT: process.env.DEMO_DB_PORT ?? "5432",
  DEMO_DB_NAME: process.env.DEMO_DB_NAME ?? "sqlboard_demo",
  DEMO_DB_USER: process.env.DEMO_DB_USER ?? "sqlboard_demo_ro",
  DEMO_DB_PASSWORD: process.env.DEMO_DB_PASSWORD ?? "demo_ro_local",
  SQLBOARD_SCHEDULER: "off",
  SQLBOARD_AUTH_RATE_LIMIT: "off",
  SQLBOARD_OUTBOX_DIR: ".data/e2e-outbox",
}

export const E2E_DB_ADMIN_URL = `${base}/postgres`
