import { Redis } from 'ioredis';
import type { RateLimitResult, AlgorithmType, MultiLayerRateLimitResult } from '../types/index.js';
import { slidingWindow, preloadScript as preloadSliding } from '../algorithms/slidingWindow.js';
import { tokenBucket, preloadScript as preloadToken } from '../algorithms/tokenBucket.js';
import { MemoryStore } from '../store/memoryStore.js';

export class Limiter {
  private redis: Redis | null;
  private memory: MemoryStore;
  private initialized: boolean = false;

  constructor(redis?: Redis) {
    this.redis = redis || null;
    this.memory = new MemoryStore();
  }

  // Preload Lua scripts for better performance
  async initialize(): Promise<void> {
    if (this.redis && !this.initialized) {
      await Promise.all([preloadSliding(this.redis), preloadToken(this.redis)]);
      this.initialized = true;
    }
  }

  // Consume rate limit for a key
  async consume(
    key: string,
    window: number,
    max: number,
    algorithm: AlgorithmType = 'sliding-window',
    burst?: number
  ): Promise<RateLimitResult> {
    if (this.redis) {
      if (algorithm === 'token-bucket') {
        return tokenBucket(this.redis, key, window, max, burst);
      }
      return slidingWindow(this.redis, key, window, max);
    }

    return this.memory.consume(key, window, max);
  }

  // Consume multiple layers simultaneously
  async consumeMany(layers: Array<{
    key: string;
    window: number;
    max: number;
    algorithm?: AlgorithmType;
    burst?: number;
  }>): Promise<MultiLayerRateLimitResult> {
    const results = await Promise.all(
      layers.map(layer => 
        this.consume(layer.key, layer.window, layer.max, layer.algorithm || 'sliding-window', layer.burst)
      )
    );
    
    return {
      allowed: results.every(r => r.allowed),
      remaining: Math.min(...results.map(r => r.remaining)),
      reset: Math.max(...results.map(r => r.reset)),
      layers: results
    };
  }

  // Check rate limit without consuming
  async peek(
    key: string,
    window: number,
    max: number,
    algorithm: AlgorithmType = 'sliding-window'
  ): Promise<RateLimitResult> {
    if (!this.redis && this.memory.peek) {
      return this.memory.peek(key, window, max);
    }

    const result = await this.consume(key, window, max, algorithm);
    
    return {
      ...result,
      allowed: result.remaining > 0,
      remaining: result.remaining,
      totalHits: result.totalHits
    };
  }

  // Reset rate limit for a key or all keys
  async reset(key?: string): Promise<void> {
    if (this.redis) {
      if (key) {
        await this.redis.del(key);
      } else {
        const keys = await this.redis.keys('rl:*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }
    } else {
      this.memory.reset(key);
    }
  }
}
