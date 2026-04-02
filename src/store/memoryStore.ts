import type { RateLimitResult, AlgorithmType } from '../types/index.js';
import { CLEANUP_INTERVAL_MS, PRUNING_BATCH_SIZE, DEFAULT_MAX_STORE_ENTRIES } from '../core/constants.js';

export interface Store {
  consume(
    key: string,
    window: number,
    max: number,
    algorithm?: AlgorithmType,
    burst?: number
  ): Promise<RateLimitResult> | RateLimitResult;
}

type Entry = {
  count: number;
  reset: number;
};

/**
 * In-memory store for rate limiting.
 * Uses a static shared store and a singleton timer to handle periodic cleanup 
 * across all instances with minimum overhead and no memory leaks.
 */
export class MemoryStore {
  // 🔹 Static shared state to avoid instance-reference leaks
  private static readonly store = new Map<string, Entry>();
  private static activeStoresCount = 0;
  private static cleanupInterval: NodeJS.Timeout | null = null;
  
  private maxEntries: number;
  private destroyed = false;

  constructor(options?: { maxEntries?: number }) {
    this.maxEntries = options?.maxEntries ?? DEFAULT_MAX_STORE_ENTRIES;

    // Register instance for global cleanup
    MemoryStore.activeStoresCount++;

    // Initialize singleton timer if not already running
    if (!MemoryStore.cleanupInterval) {
      MemoryStore.cleanupInterval = setInterval(() => {
        MemoryStore.pruneExpiredEntries();
      }, CLEANUP_INTERVAL_MS);

      // Allow Node.js to exit even if this timer is active
      if (typeof (MemoryStore.cleanupInterval as any).unref === 'function') {
        (MemoryStore.cleanupInterval as any).unref();
      }
    }
  }

  /**
   * Static periodic pruning of expired entries to prevent memory leaks 
   * without holding onto instance references.
   */
  private static pruneExpiredEntries(): void {
    const now = Date.now();
    let prunedCount = 0;
    
    // We only prune a subset to keep latency low
    for (const [key, entry] of MemoryStore.store.entries()) {
      if (entry.reset < now) {
        MemoryStore.store.delete(key);
        prunedCount++;
        
        if (prunedCount >= PRUNING_BATCH_SIZE) break;
      }
    }
  }

  /**
   * Enforce max entries with FIFO eviction (oldest first)
   */
  private enforceMaxEntries(): void {
    if (MemoryStore.store.size <= this.maxEntries) return;

    const toDelete = MemoryStore.store.size - this.maxEntries;
    let deleted = 0;

    // Delete oldest entries (first inserted = FIFO)
    for (const key of MemoryStore.store.keys()) {
      MemoryStore.store.delete(key);
      deleted++;
      if (deleted >= toDelete) break;
    }
  }

  /**
   * Destroy the store and deregister from global cleanup.
   * Includes the mandatory safety guard to prevent redundant counter decrements.
   */
  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    // 🔹 Deregister from global pruning
    MemoryStore.activeStoresCount--;

    // If no more active stores, stop the singleton timer
    if (MemoryStore.activeStoresCount === 0 && MemoryStore.cleanupInterval) {
      clearInterval(MemoryStore.cleanupInterval);
      MemoryStore.cleanupInterval = null;
    }

    // Note: We don't clear the shared static store here as other instances
    // might still be relying on it. Independent stores use the consume/reset API.
  }

  public consume(key: string, window: number, max: number): RateLimitResult {
    const now = Date.now();
    const entry = MemoryStore.store.get(key);

    if (!entry || entry.reset < now) {
      const reset = now + window * 1000;
      MemoryStore.store.set(key, { count: 1, reset });

      // Enforce max entries to prevent memory leak
      this.enforceMaxEntries();

      return {
        allowed: true,
        limit: max,
        remaining: max - 1,
        reset: Math.ceil(reset / 1000),
        totalHits: 1,
      };
    }

    entry.count++;
    const allowed = entry.count <= max;

    return {
      allowed,
      limit: max,
      remaining: Math.max(0, max - entry.count),
      reset: Math.ceil(entry.reset / 1000),
      totalHits: entry.count,
    };
  }

  /**
   * Peek at rate limit status without consuming
   * @param key - Rate limit key
   * @param window - Time window in seconds
   * @param max - Maximum requests allowed
   * @returns Current rate limit status
   */
  peek(key: string, window: number, max: number): RateLimitResult {
    const now = Date.now();
    const entry = MemoryStore.store.get(key);

    if (!entry || entry.reset < now) {
      // No active limit - fresh state
      return {
        allowed: true,
        limit: max,
        remaining: max,
        reset: Math.ceil((now + window * 1000) / 1000),
        totalHits: 0,
      };
    }

    const allowed = entry.count < max;

    return {
      allowed,
      limit: max,
      remaining: Math.max(0, max - entry.count),
      reset: Math.ceil(entry.reset / 1000),
      totalHits: entry.count,
    };
  }

  /**
   * Reset rate limit for a specific key or all keys
   * @param key - Specific key to reset (optional). If omitted, resets all keys.
   */
  reset(key?: string): void {
    if (key) {
      MemoryStore.store.delete(key);
    } else {
      MemoryStore.store.clear();
    }
  }

  getStats() {
    return {
      totalKeys: MemoryStore.store.size,
    };
  }

  clear() {
    MemoryStore.store.clear();
  }
}
