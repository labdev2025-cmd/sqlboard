import { z } from "zod"

export const DIALECTS = ["postgres", "mysql", "sqlite", "mssql"] as const
export type Dialect = (typeof DIALECTS)[number]

export const DIALECT_LABELS: Record<Dialect, string> = {
  postgres: "PostgreSQL",
  mysql: "MySQL / MariaDB",
  sqlite: "SQLite",
  mssql: "SQL Server",
}

export const DEFAULT_PORTS: Record<Dialect, number | null> = {
  postgres: 5432,
  mysql: 3306,
  sqlite: null,
  mssql: 1433,
}

export const SSL_MODES = ["disable", "require", "verify-full"] as const
export const SSL_LABELS: Record<(typeof SSL_MODES)[number], string> = {
  disable: "Desativado",
  require: "Obrigatório (sem validar certificado)",
  "verify-full": "Obrigatório e validar certificado",
}

export const PURPOSES = ["read", "write"] as const
export const PURPOSE_LABELS: Record<(typeof PURPOSES)[number], string> = {
  read: "Leitura (queries e telas)",
  write: "Escrita controlada (só ações)",
}

/** Form/API payload. `password`: undefined keeps the stored one. */
export const connectionInputSchema = z
  .object({
    name: z.string().trim().min(1, "Informe um nome.").max(80),
    description: z.string().trim().max(500).default(""),
    dialect: z.enum(DIALECTS).default("postgres"),
    host: z.string().trim().max(255).default(""),
    port: z.coerce.number().int().min(1).max(65535).nullable().default(null),
    database: z
      .string()
      .trim()
      .min(1, "Informe o banco (ou o arquivo, no SQLite).")
      .max(500),
    username: z.string().trim().max(128).default(""),
    password: z.string().max(1024).optional(),
    clearPassword: z.boolean().optional(),
    ssl: z.enum(SSL_MODES).default("disable"),
    statementTimeoutMs: z.coerce
      .number()
      .int()
      .min(1000)
      .max(900_000)
      .default(30_000),
    defaultRowLimit: z.coerce
      .number()
      .int()
      .min(1)
      .max(1_000_000)
      .default(5000),
    maxRowLimit: z.coerce.number().int().min(1).max(1_000_000).default(50_000),
    purpose: z.enum(PURPOSES).default("read"),
  })
  .refine((v) => v.defaultRowLimit <= v.maxRowLimit, {
    message: "O limite padrão não pode passar do limite máximo.",
    path: ["defaultRowLimit"],
  })
  .refine((v) => v.dialect === "sqlite" || v.host.length > 0, {
    message: "Informe o host.",
    path: ["host"],
  })

export type ConnectionInput = z.input<typeof connectionInputSchema>

/** What the browser receives about a connection: never the password. */
export type ConnectionView = {
  id: string
  name: string
  description: string
  dialect: Dialect
  host: string
  port: number | null
  database: string
  username: string
  hasPassword: boolean
  ssl: (typeof SSL_MODES)[number]
  statementTimeoutMs: number
  defaultRowLimit: number
  maxRowLimit: number
  purpose: (typeof PURPOSES)[number]
  isDemo: boolean
  schemaCachedAt: string | null
  createdAt: string
  updatedAt: string
}
