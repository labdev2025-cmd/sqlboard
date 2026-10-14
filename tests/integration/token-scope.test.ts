import { randomUUID } from "node:crypto"

import { beforeAll, describe, expect, it } from "vitest"

import * as actionPreview from "@/app/api/actions/[id]/preview/route"
import * as actionRun from "@/app/api/actions/[id]/run/route"
import * as appRoute from "@/app/api/apps/[id]/route"
import * as publish from "@/app/api/apps/[id]/publish/route"
import * as shares from "@/app/api/apps/[id]/shares/route"
import * as apps from "@/app/api/apps/route"
import * as scheduleRoute from "@/app/api/schedules/[id]/route"
import * as scheduleRun from "@/app/api/schedules/[id]/run/route"
import * as schedules from "@/app/api/schedules/route"
import { createToken } from "@/server/services/api-tokens"

import { makeUser } from "../support/fixtures"

type Handler = (
  request: Request,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>

let token: string

function call(handler: unknown, method: string, body?: unknown) {
  return (handler as Handler)(
    new Request("http://localhost/api/x", {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: randomUUID() }) }
  )
}

beforeAll(async () => {
  const admin = await makeUser("admin")
  token = (await createToken(admin, { name: "Agente" })).token
})

describe("escopo dos tokens de API", () => {
  it("token lê e edita rascunhos (controle)", async () => {
    const response = await call(apps.GET, "GET")
    expect(response.status).toBe(200)
  })

  it("publicar, compartilhar, excluir, ações de escrita e agendamentos exigem a sessão", async () => {
    const cases: [unknown, string, unknown?][] = [
      [publish.POST, "POST", {}],
      [publish.DELETE, "DELETE"],
      [shares.PUT, "PUT", []],
      [appRoute.DELETE, "DELETE"],
      [actionPreview.POST, "POST", { params: {} }],
      [actionRun.POST, "POST", { token: "x" }],
      [schedules.POST, "POST", {}],
      [scheduleRoute.PUT, "PUT", {}],
      [scheduleRoute.DELETE, "DELETE"],
      [scheduleRun.POST, "POST"],
    ]
    for (const [handler, method, body] of cases) {
      const response = await call(handler, method, body)
      expect(response.status, `${method} deveria recusar o token`).toBe(401)
    }
  })
})
