/** Environment shared by Vitest integration tests (fictitious values only). */
export const TEST_ENV = {
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ??
    "postgres://sqlboard:sqlboard@localhost:5432/sqlboard_test",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123",
  BETTER_AUTH_URL: "http://localhost:3000",
  SQLBOARD_ENCRYPTION_KEY: "dGVzdC1rZXktdGVzdC1rZXktdGVzdC1rZXktMzJieXQ=",
  SQLBOARD_ENCRYPTION_KEY_VERSION: "1",
  DEMO_DB_HOST: process.env.DEMO_DB_HOST ?? "localhost",
  DEMO_DB_PORT: process.env.DEMO_DB_PORT ?? "5432",
  DEMO_DB_NAME: process.env.DEMO_DB_NAME ?? "sqlboard_demo",
  DEMO_DB_USER: process.env.DEMO_DB_USER ?? "sqlboard_demo_ro",
  DEMO_DB_PASSWORD: process.env.DEMO_DB_PASSWORD ?? "demo_ro_local",
  DEMO_DB_WRITE_USER: process.env.DEMO_DB_WRITE_USER ?? "sqlboard_demo_rw",
  DEMO_DB_WRITE_PASSWORD: process.env.DEMO_DB_WRITE_PASSWORD ?? "demo_rw_local",
} as const
