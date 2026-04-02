import { Redis } from 'ioredis';
import type { Store } from './types.js';
import type { RateLimitResult, AlgorithmType } from '../types/index.js';
import { slidingWindowLua, tokenBucketLua, fixedWindowLua } from './lua/index.js';

export interface RedisStoreOptions {
  timeoutMs?: number;
}

export class RedisStore implements Store {
  private redis: Redis;
  private initialized: boolean = false;
  private timeoutMs: number;
  private shas: Record<string, string> = {};

  constructor(redis: Redis, options?: RedisStoreOptions) {
    this.redis = redis;
    this.timeoutMs = options?.timeoutMs ?? 1000;
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      const [sliding, token, fixed] = await Promise.all([
        this.redis.script('LOAD', slidingWindowLua) as Promise<string>,
        this.redis.script('LOAD', tokenBucketLua) as Promise<string>,
        this.redis.script('LOAD', fixedWindowLua) as Promise<string>,
      ]);
      this.shas['sliding-window'] = sliding;
      this.shas['token-bucket'] = token;
      this.shas['fixed-window'] = fixed;
      this.initialized = true;
    }
  }

  // Wraps an asynchronous operation in a timeout to prevent hanging the API if Redis hangs
  private async safeExecute<T>(
    fn: () => Promise<T>
  ): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Redis timeout')), this.timeoutMs)
    );

    return Promise.race([fn(), timeout]);
  }

  // Wrapper providing a single retry logic against transient faults
  private async executeWithRetry<T>(
    fn: () => Promise<T>
  ): Promise<T> {
    try {
      return await this.safeExecute(fn);
    } catch (err) {
      // retry once (only for transient issues)
      return await this.safeExecute(fn);
    }
  }

  private async execScript(algo: AlgorithmType, keys: string[], args: (string | number)[]): Promise<any> {
    const sha = this.shas[algo];
    if (!sha) throw new Error(`Redis script for algorithm ${algo} not initialized`);
    try {
      return await this.redis.evalsha(sha, keys.length, ...keys, ...args);
    } catch (error: any) {
      if (error.code === 'NOSCRIPT') {
        // Fallback or retry logic if sha is lost
        let script = '';
        if (algo === 'sliding-window') script = slidingWindowLua;
        else if (algo === 'token-bucket') script = tokenBucketLua;
        else if (algo === 'fixed-window') script = fixedWindowLua;

        const newSha = await this.redis.script('LOAD', script) as string;
        this.shas[algo] = newSha;
        return await this.redis.evalsha(newSha, keys.length, ...keys, ...args);
      }
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async consume(
    key: string,
    window: number,
    max: number,
    algorithm: AlgorithmType = 'sliding-window',
    _burst?: number
  ): Promise<RateLimitResult> {
    await this.ensureInitialized();
    const now = Date.now();

    if (algorithm === 'token-bucket') {
      const refillRate = max / window;
      const res = await this.executeWithRetry(() =>
        this.execScript('token-bucket', [key], [now, max, refillRate, window])
      ) as [number, number, number];
      return {
        allowed: res[0] === 1,
        remaining: res[1],
        reset: res[2],
        totalHits: max - res[1] + (res[0] === 1 ? 1 : 0)
      };
    }

    if (algorithm === 'fixed-window') {
      const count = await this.executeWithRetry(() =>
        this.execScript('fixed-window', [key], [max, window])
      ) as number;
      return {
        allowed: count <= max,
        remaining: Math.max(0, max - count),
        reset: Math.ceil((now + window * 1000) / 1000),
        totalHits: count
      };
    }

    // sliding-window
    const windowStart = now - window * 1000;
    const count = await this.executeWithRetry(() =>
      this.execScript('sliding-window', [key], [now, windowStart, window, max])
    ) as number;
    return {
      allowed: count <= max,
      remaining: Math.max(0, max - count),
      reset: Math.ceil((now + window * 1000) / 1000),
      totalHits: count
    };
  }

  async peek(
    key: string,
    window: number,
    max: number,
    algorithm: AlgorithmType = 'sliding-window'
  ): Promise<RateLimitResult> {
    await this.ensureInitialized();
    return this.executeWithRetry(async () => {
      let count = 0;

      if (algorithm === 'token-bucket' || algorithm === 'fixed-window') {
        const val = await this.redis.get(key);
        count = val ? parseInt(val, 10) : 0;
      } else {
        const now = Date.now();
        const windowStart = now - window * 1000;
        count = await this.redis.zcount(key, windowStart, '+inf');
      }

      const allowed = count < max;
      const remaining = Math.max(0, max - count);
      const reset = Math.ceil((Date.now() + window * 1000) / 1000);

      return {
        allowed,
        remaining,
        reset,
        totalHits: count
      };
    });
  }

  async reset(key?: string): Promise<void> {
    await this.ensureInitialized();
    return this.executeWithRetry(async () => {
      if (key) {
        await this.redis.del(key);
      } else {
        const keys = await this.redis.keys('rl:*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }
    });
  }

  getStats(): Record<string, any> {
    return {
      type: 'redis',
      connected: this.redis.status === 'ready'
    };
  }
}
