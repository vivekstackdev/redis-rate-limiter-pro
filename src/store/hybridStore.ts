import type { Store } from './types.js';
import type { RateLimitResult, AlgorithmType } from '../types/index.js';
import { RedisStore } from './redisStore.js';
import { MemoryStore } from './memoryStore.js';

export interface HybridStoreOptions {
  redis: RedisStore;
  memory: MemoryStore;
  failStrategy?: 'fail-open' | 'fail-closed' | 'fallback-to-memory';
}

export class HybridStore implements Store {
  private redisStore: RedisStore;
  private memoryStore: MemoryStore;
  private failStrategy: 'fail-open' | 'fail-closed' | 'fallback-to-memory';

  constructor(options: HybridStoreOptions) {
    this.redisStore = options.redis;
    this.memoryStore = options.memory || new MemoryStore(); // 🛡️ Safety guard: MUST exist always
    this.failStrategy = options.failStrategy ?? 'fallback-to-memory';
  }

  async consume(
    key: string,
    window: number,
    max: number,
    algorithm: AlgorithmType = 'sliding-window',
    burst?: number
  ): Promise<RateLimitResult> {
    try {
      return await this.redisStore.consume(key, window, max, algorithm, burst);
    } catch (error) {
      if (this.failStrategy === 'fallback-to-memory') {
        // Fallback to memory on Redis failure
        return this.memoryStore.consume(key, window, max);
      }
      if (this.failStrategy === 'fail-open') {
        return {
          allowed: true,
          limit: max,
          remaining: max,
          reset: Math.ceil((Date.now() + window * 1000) / 1000),
          totalHits: 0
        };
      }
      throw error; // fail-closed
    }
  }

  async peek(
    key: string,
    window: number,
    max: number,
    algorithm: AlgorithmType = 'sliding-window'
  ): Promise<RateLimitResult> {
    try {
      return await this.redisStore.peek(key, window, max, algorithm);
    } catch (error) {
      if (this.failStrategy === 'fallback-to-memory') {
        return this.memoryStore.peek(key, window, max);
      }
      if (this.failStrategy === 'fail-open') {
        return {
          allowed: true,
          limit: max,
          remaining: max,
          reset: Math.ceil((Date.now() + window * 1000) / 1000),
          totalHits: 0
        };
      }
      throw error;
    }
  }

  async reset(key?: string): Promise<void> {
    try {
      await this.redisStore.reset(key);
      this.memoryStore.reset(key);
    } catch (error) {
      this.memoryStore.reset(key);
    }
  }

  getStats(): Record<string, any> {
    return {
      type: 'hybrid',
      memory: this.memoryStore.getStats(),
      redis: this.redisStore.getStats()
    };
  }

  destroy(): void {
    this.memoryStore.destroy();
  }
}
