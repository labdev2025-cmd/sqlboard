import "server-only"

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não definida. Veja .env.example.`
    )
  }
  return value
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL")
  },
  get authSecret() {
    return required("BETTER_AUTH_SECRET")
  },
  get appUrl() {
    return process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
  },
}
