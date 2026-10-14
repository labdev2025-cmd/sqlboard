/** Liveness probe (no database access). */
export function GET() {
  return Response.json({ status: "ok" })
}
