import { Redis } from 'ioredis';
import type { Store } from './types.js';
import type { RateLimitResult, AlgorithmType } from '../types/index.js';
import { slidingWindowLua, tokenBucketLua, fixedWindowLua } from './lua/index.js';
import { 
  REDIS_DEFAULT_TIMEOUT_MS, 
  REDIS_RETRY_LIMIT, 
  REDIS_RETRY_BACKOFF_MS, 
  REDIS_MAX_BACKOFF_MS,
  REDIS_CIRCUIT_BREAKER_INTERVAL_MS
} from '../core/constants.js';

export interface RedisStoreOptions {
  timeoutMs?: number;
  retryLimit?: number;
  logger?: {
    warn: (msg: string, ...args: any[]) => void;
    error: (msg: string, ...args: any[]) => void;
    info: (msg: string, ...args: any[]) => void;
  };
}

/**
 * Production-ready Redis store for distributed rate limiting.
 * Includes classified retries, exponential backoff, and script re-synchronization.
 */
export class RedisStore implements Store {
  private redis: Redis;
  private initialized: boolean = false;
  private timeoutMs: number;
  private shas: Record<string, string> = {};
  private logger: NonNullable<RedisStoreOptions['logger']>;
  private retryLimit: number;
  private lastFailureTime = 0;

  constructor(redis: Redis, options?: RedisStoreOptions) {
    this.redis = redis;
    this.timeoutMs = options?.timeoutMs ?? REDIS_DEFAULT_TIMEOUT_MS;
    this.retryLimit = options?.retryLimit ?? REDIS_RETRY_LIMIT;
    this.logger = options?.logger ?? {
      warn: (msg, ...args) => console.warn(`[RedisStore] ${msg}`, ...args),
      error: (msg, ...args) => console.error(`[RedisStore] ${msg}`, ...args),
      info: (msg, ...args) => console.info(`[RedisStore] ${msg}`, ...args),
    };
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const [sliding, token, fixed] = await Promise.all([
        this.redis.script('LOAD', slidingWindowLua) as Promise<string>,
        this.redis.script('LOAD', tokenBucketLua) as Promise<string>,
        this.redis.script('LOAD', fixedWindowLua) as Promise<string>,
      ]);

      this.shas['sliding-window'] = sliding;
      this.shas['token-bucket'] = token;
      this.shas['fixed-window'] = fixed;
      this.initialized = true;
    } catch (error: any) {
      this.logger.error('Failed to load Lua scripts into Redis', error);
      throw error;
    }
  }

  /**
   * Race an operation against a timeout to prevent API hangs.
   */
  private async safeExecute<T>(fn: () => Promise<T>): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Redis operation timed out')), this.timeoutMs)
    );

    return Promise.race([fn(), timeout]);
  }

  /**
   * Execute with classified retry logic and exponential backoff.
   * Only retries transient errors like timeouts.
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    // 🛡️ Circuit Breaker: If we've had a recent failure, skip Redis entirely
    if (Date.now() - this.lastFailureTime < REDIS_CIRCUIT_BREAKER_INTERVAL_MS) {
      throw new Error('Redis store circuit breaker is open. Falling back.');
    }

    let lastError: any;

    for (let attempt = 0; attempt <= this.retryLimit; attempt++) {
      try {
        return await this.safeExecute(fn);
      } catch (error: any) {
        lastError = error;
        this.lastFailureTime = Date.now(); // Mark failure to maintain beaker state

        // Classification: Only retry on timeouts or transient connection issues
        const isTransient = 
          error.message.includes('timed out') || 
          error.code === 'ECONNREFUSED' || 
          error.code === 'ETIMEDOUT';

        if (!isTransient || attempt === this.retryLimit) {
          throw error;
        }

        // Full Jitter Backoff (AWS Recommended Pattern)
        // This spreads retries across the window to prevent "retry storms"
        const base = REDIS_RETRY_BACKOFF_MS * Math.pow(2, attempt);
        const backoff = Math.min(Math.random() * base, REDIS_MAX_BACKOFF_MS);
        
        // Prioritized Log Sampling: Always log the FIRST failure, sample 1% thereafter
        if (attempt === 0 || Math.random() < 0.01) {
          this.logger.warn(`Transient Redis error (attempt ${attempt + 1}). Retrying in ${Math.round(backoff)}ms...`, error.message);
        }
        
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }

    throw lastError;
  }

  /**
   * Core script execution logic with automatic NOSCRIPT recovery.
   */
  private async execScript(algo: AlgorithmType, keys: string[], args: (string | number)[]): Promise<any> {
    const sha = this.shas[algo];
    
    // Defensive check: Should have been initialized
    if (!sha) {
      this.logger.warn(`Script for ${algo} not found in SHA cache. Re-initializing...`);
      await this.initialize();
      return this.execScript(algo, keys, args);
    }

    try {
      return await this.redis.evalsha(sha, keys.length, ...keys, ...args);
    } catch (error: any) {
      if (error.code === 'NOSCRIPT') {
        this.logger.warn('Redis lost script SHA. Synchronizing scripts and retrying...');
        this.initialized = false; // Force re-LOAD
        await this.initialize();
        return await this.redis.evalsha(this.shas[algo], keys.length, ...keys, ...args);
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
        limit: max,
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
        limit: max,
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
      limit: max,
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
        limit: max,
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
