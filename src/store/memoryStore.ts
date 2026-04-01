import type { RateLimitResult, AlgorithmType } from '../types/index.js';

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

export class MemoryStore {
  private store = new Map<string, Entry>();
  private maxEntries = 50_000; // Prevent memory leak
  private cleanupInterval: NodeJS.Timeout | null = null;
  private static instanceCount = 0; // Track instances

  constructor(options?: { maxEntries?: number }) {
    this.maxEntries = options?.maxEntries ?? 50_000;
    
    // Only create cleanup interval if this is the first instance
    // This prevents multiple intervals leaking
    if (MemoryStore.instanceCount === 0) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 60000);
      
      // Allow cleanup in Node.js
      if (typeof this.cleanupInterval.unref === 'function') {
        this.cleanupInterval.unref();
      }
    }
    
    MemoryStore.instanceCount++;
  }

  /**
   * Clean up expired entries (batch processing for performance)
   */
  private cleanup(): void {
    const now = Date.now();
    let deleted = 0;
    const targetDelete = Math.min(this.store.size, 1000); // Batch cleanup
    
    for (const [key, entry] of this.store.entries()) {
      if (entry.reset < now) {
        this.store.delete(key);
        deleted++;
        if (deleted >= targetDelete) break;
      }
    }
  }

  /**
   * Enforce max entries with FIFO eviction (oldest first)
   */
  private enforceMaxEntries(): void {
    if (this.store.size <= this.maxEntries) return;
    
    const toDelete = this.store.size - this.maxEntries;
    let deleted = 0;
    
    // Delete oldest entries (first inserted = FIFO)
    for (const key of this.store.keys()) {
      this.store.delete(key);
      deleted++;
      if (deleted >= toDelete) break;
    }
  }

  /**
   * Destroy the store and cleanup resources
   * Call this when shutting down to prevent interval leaks
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    MemoryStore.instanceCount--;
    this.store.clear();
  }

  consume(key: string, window: number, max: number): RateLimitResult {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.reset < now) {
      const reset = now + window * 1000;
      this.store.set(key, { count: 1, reset });
      
      // Enforce max entries to prevent memory leak
      this.enforceMaxEntries();
      
      return {
        allowed: true,
        remaining: max - 1,
        reset: Math.ceil(reset / 1000),
        totalHits: 1,
      };
    }

    entry.count++;
    const allowed = entry.count <= max;

    return {
      allowed,
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
    const entry = this.store.get(key);

    if (!entry || entry.reset < now) {
      // No active limit - fresh state
      return {
        allowed: true,
        remaining: max,
        reset: Math.ceil((now + window * 1000) / 1000),
        totalHits: 0,
      };
    }

    const allowed = entry.count < max;

    return {
      allowed,
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
      this.store.delete(key);
    } else {
      this.store.clear();
    }
  }

  getStats() {
    return {
      totalKeys: this.store.size,
    };
  }

  clear() {
    this.store.clear();
  }
}
