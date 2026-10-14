import "server-only"

import { ZodError } from "zod"

import { getUserFromHeaders, type CurrentUser } from "@/server/auth/session"
import type { Role } from "@/lib/auth/roles"

/** Error with an HTTP status and a user-facing (pt-BR) message. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message)
  }
}

export const unauthorized = () =>
  new HttpError(401, "Sessão expirada ou inexistente. Entre novamente.")
export const forbidden = (message = "Você não tem permissão para esta ação.") =>
  new HttpError(403, message)
export const notFound = (message = "Item não encontrado.") =>
  new HttpError(404, message)
export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, message, details)

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json(
      { error: error.message, details: error.details },
      { status: error.status }
    )
  }
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: "Dados inválidos.",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    )
  }
  if (isUniqueViolation(error)) {
    return Response.json(
      { error: "Já existe um item com esse nome." },
      { status: 409 }
    )
  }
  console.error(error)
  return Response.json(
    { error: "Erro interno. Tente novamente." },
    { status: 500 }
  )
}

function isUniqueViolation(error: unknown) {
  const cause = (error as { cause?: { code?: string } })?.cause
  return (
    (error as { code?: string })?.code === "23505" || cause?.code === "23505"
  )
}

type Handler<C> = (ctx: {
  request: Request
  user: CurrentUser
  params: C
}) => Promise<Response> | Response

type Options = { roles?: Role[] }

/**
 * Wraps a Route Handler with authentication, role checks and uniform error
 * handling. Every API route goes through here: permission checks live on the
 * server, never only in the UI.
 */
export function route<C = Record<string, never>>(
  handler: Handler<C>,
  options: Options = {}
) {
  return async (
    request: Request,
    context: { params: Promise<C> }
  ): Promise<Response> => {
    try {
      const user = await getUserFromHeaders(request.headers)
      if (!user) throw unauthorized()
      if (options.roles && !options.roles.includes(user.role)) {
        throw forbidden()
      }
      const params = (await context?.params) ?? ({} as C)
      return await handler({ request, user, params })
    } catch (error) {
      return errorResponse(error)
    }
  }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw badRequest("Corpo da requisição inválido (JSON esperado).")
  }
}
