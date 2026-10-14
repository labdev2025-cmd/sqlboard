import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"

import { getUserFromHeaders } from "@/server/auth/session"
import { createMcpServer } from "@/server/mcp/server"

/**
 * MCP endpoint (Streamable HTTP, stateless, JSON responses). Only API tokens
 * (`Authorization: Bearer sqlb_…`, created in /settings/tokens) are accepted:
 * no cookies, so a browser page cannot drive it on the user's behalf.
 */
async function handle(request: Request): Promise<Response> {
  const bearer = /^bearer\s/i.test(request.headers.get("authorization") ?? "")
  const user = bearer
    ? await getUserFromHeaders(request.headers, { allowToken: true })
    : null
  if (!user) {
    return Response.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message:
            "Token ausente, inválido ou expirado. Crie um em /settings/tokens.",
        },
        id: null,
      },
      {
        status: 401,
        headers: { "www-authenticate": 'Bearer realm="sqlboard"' },
      }
    )
  }
  const server = createMcpServer(user)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)
  try {
    return await transport.handleRequest(request)
  } finally {
    void server.close()
  }
}

export const POST = handle
export const GET = handle
export const DELETE = handle
