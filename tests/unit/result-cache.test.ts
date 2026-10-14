import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { QueryResult } from "@/lib/data-types"
import { ResultCache } from "@/server/execution/cache"

/** Result whose `rows` serialize to exactly `bytes` characters. */
function resultOf(bytes: number): QueryResult {
  // JSON of [["xxx"]] = 6 chars of overhead.
  return {
    columns: [{ name: "v", kind: "text", nativeType: "text" }],
    rows: [["x".repeat(bytes - 6)]],
    rowCount: 1,
    truncated: false,
    durationMs: 1,
    limit: 10,
  }
}

describe("cache de resultados", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-14T12:00:00Z"))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("expira a entrada depois do TTL", () => {
    const cache = new ResultCache()
    const result = resultOf(100)
    cache.set("k", result, 30)
    expect(cache.get("k")).toBe(result)
    vi.advanceTimersByTime(29_000)
    expect(cache.get("k")).toBe(result)
    vi.advanceTimersByTime(1_001)
    expect(cache.get("k")).toBeNull()
  })

  it("regravar a mesma chave renova o TTL", () => {
    const cache = new ResultCache()
    cache.set("k", resultOf(100), 10)
    vi.advanceTimersByTime(8_000)
    const fresh = resultOf(120)
    cache.set("k", fresh, 10)
    vi.advanceTimersByTime(8_000)
    expect(cache.get("k")).toBe(fresh)
  })

  it("descarta as entradas mais antigas quando passa do limite de memória", () => {
    const cache = new ResultCache(1000)
    cache.set("a", resultOf(240), 60)
    cache.set("b", resultOf(240), 60)
    cache.set("c", resultOf(240), 60)
    cache.set("d", resultOf(240), 60)
    // 960 bytes: tudo cabe.
    expect(["a", "b", "c", "d"].map((k) => cache.get(k) !== null)).toEqual([
      true,
      true,
      true,
      true,
    ])
    cache.set("e", resultOf(240), 60)
    // 1200 > 1000: sai só a mais antiga.
    expect(cache.get("a")).toBeNull()
    expect(["b", "c", "d", "e"].every((k) => cache.get(k) !== null)).toBe(true)
  })

  it("não guarda resultado maior que um quarto do orçamento", () => {
    const cache = new ResultCache(1000)
    cache.set("pequeno", resultOf(200), 60)
    cache.set("grande", resultOf(251), 60)
    expect(cache.get("grande")).toBeNull()
    expect(cache.get("pequeno")).not.toBeNull()
  })

  it("a chave muda com versão da conexão, valores e limite", () => {
    const cache = new ResultCache()
    const query = {
      sql: "select $1",
      values: ["CE"],
      params: { uf: "CE" },
      removedClauses: 0,
    }
    const base = cache.key("c1", 1, query, 100)
    expect(cache.key("c1", 1, { ...query }, 100)).toBe(base)
    expect(cache.key("c1", 2, query, 100)).not.toBe(base)
    expect(cache.key("c1", 1, { ...query, values: ["SP"] }, 100)).not.toBe(base)
    expect(cache.key("c1", 1, query, 50)).not.toBe(base)
    expect(cache.key("c2", 1, query, 100)).not.toBe(base)
  })
})
