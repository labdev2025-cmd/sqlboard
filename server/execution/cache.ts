import "server-only"

import { createHash } from "node:crypto"

import type { QueryResult } from "@/lib/data-types"
import type { CompiledQuery } from "@/lib/sql-params"

type Entry = { result: QueryResult; expiresAt: number; size: number }

/**
 * In-process result cache with per-query TTL (PROMPT.md §0.2, F4). Keys include
 * the connection version, the compiled SQL, the bound values and the row limit,
 * so a permission check always happens before a lookup and edits invalidate it.
 * Bounded by an approximate byte budget (oldest entries evicted first).
 */
class ResultCache {
  private entries = new Map<string, Entry>()
  private bytes = 0

  constructor(private maxBytes = 64 * 1024 * 1024) {}

  key(
    connectionId: string,
    version: number,
    query: CompiledQuery,
    limit: number
  ) {
    return createHash("sha256")
      .update(
        JSON.stringify([connectionId, version, query.sql, query.values, limit])
      )
      .digest("hex")
  }

  get(key: string): QueryResult | null {
    const entry = this.entries.get(key)
    if (!entry) return null
    if (entry.expiresAt < Date.now()) {
      this.delete(key)
      return null
    }
    return entry.result
  }

  set(key: string, result: QueryResult, ttlSeconds: number) {
    const size = JSON.stringify(result.rows).length
    if (size > this.maxBytes / 4) return
    this.delete(key)
    this.entries.set(key, {
      result,
      expiresAt: Date.now() + ttlSeconds * 1000,
      size,
    })
    this.bytes += size
    for (const [oldest] of this.entries) {
      if (this.bytes <= this.maxBytes) break
      this.delete(oldest)
    }
  }

  delete(key: string) {
    const entry = this.entries.get(key)
    if (entry) {
      this.bytes -= entry.size
      this.entries.delete(key)
    }
  }

  clear() {
    this.entries.clear()
    this.bytes = 0
  }
}

declare global {
  var __sqlboardResultCache: ResultCache | undefined
}

export const resultCache = (globalThis.__sqlboardResultCache ??=
  new ResultCache())
