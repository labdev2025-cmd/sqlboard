import type { AppQuery } from "./index"

/** Turns a free-form name into a binding identifier ("Vendas 2025" → vendas_2025). */
export function toIdentifier(name: string, fallback = "consulta") {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "q_$1")
  return base || fallback
}

/** Copies a library query into a screen, keeping a reference to the origin. */
export function querySnapshot(
  saved: {
    id: string
    name: string
    connectionId: string
    sql: string
    params: AppQuery["params"]
    cacheTtlSeconds: number
  },
  taken: string[]
): AppQuery {
  const base = toIdentifier(saved.name)
  let name = base
  for (let n = 2; taken.includes(name); n++) name = `${base}_${n}`
  return {
    id: `q${Math.random().toString(36).slice(2, 8)}`,
    name,
    connectionId: saved.connectionId,
    sql: saved.sql,
    params: saved.params,
    runMode: "auto",
    sourceQueryId: saved.id,
    cacheTtlSeconds: saved.cacheTtlSeconds,
    paramBindings: {},
  }
}
