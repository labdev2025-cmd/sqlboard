import { describe, expect, it } from "vitest"

import { auth } from "@/server/auth/auth"
import { db } from "@/server/db/client"
import { rateLimit } from "@/server/db/schema"

function signIn(ip: string, email = "ninguem@exemplo.test") {
  return auth.handler(
    new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({
        email,
        password: "senha-errada-123",
      }),
    })
  )
}

describe("limite de tentativas de login", () => {
  it("bloqueia depois de 10 tentativas por minuto e guarda no banco", async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`
    const statuses: number[] = []
    for (let i = 0; i < 11; i++) statuses.push((await signIn(ip)).status)
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true)
    expect(statuses[10]).toBe(429)
    // Another address is not affected.
    expect((await signIn("198.51.100.7")).status).toBe(401)
    const rows = await db.select().from(rateLimit)
    expect(rows.some((r) => r.key.includes(ip))).toBe(true)
  })

  it("limita também por conta, vindo de endereços diferentes", async () => {
    const email = `alvo-${Date.now()}@exemplo.test`
    const statuses: number[] = []
    for (let i = 0; i < 21; i++) {
      statuses.push((await signIn(`192.0.2.${i + 1}`, email)).status)
    }
    expect(statuses.slice(0, 20).every((s) => s === 401)).toBe(true)
    expect(statuses[20]).toBe(429)
  })
})
