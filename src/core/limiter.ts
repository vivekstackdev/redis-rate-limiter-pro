import type { RateLimitContext, RateLimiterConfig } from '../types/index.js';
import { Engine } from './engine.js';
import { compilePolicies } from '../policies/compiler.js';
import { MemoryStore } from '../store/memoryStore.js';
import type { Store } from '../store/types.js';

export class Limiter {
  public store: Store;
  public config: RateLimiterConfig;
  private engine: Engine;

  constructor(config: RateLimiterConfig) {
    this.config = config;
    this.store = config.store || new MemoryStore();
    
    const compiledPolicies = compilePolicies(config.policies);

    // Initialize engine
    this.engine = new Engine(this.store, this.config, compiledPolicies);
  }

  async check(ctx: RateLimitContext) {
    if (this.config.skip && this.config.skip(ctx)) {
      return { allowed: true };
    }

    let resultObj;
    if (this.config.layers && this.config.layers.length > 0) {
      resultObj = await (this.engine as any).executeLayers?.(ctx, this.config.layers);
    } else {
      resultObj = await this.engine.check(ctx);
    }
    
    // Result is wrapped in check
    const result = resultObj?.result || resultObj;

    const headers: Record<string, string> = Object.create(null);

    // Handle blocking and headers
    if (resultObj?.key || result?.limit !== undefined) {
      const limitVal = resultObj?.limit !== undefined ? Math.max(0, resultObj.limit) : this.config.default?.max;
      if (limitVal !== undefined) headers['X-RateLimit-Limit'] = String(limitVal);

      headers['X-RateLimit-Remaining'] = String(result.remaining);
      headers['X-RateLimit-Reset'] = String(result.reset);
      
      if (!result.allowed) {
        headers['Retry-After'] = String(result.reset - Math.floor(Date.now() / 1000));
      }
    }

    let response = null;
    if (!result.allowed) {
      response = {
        status: 429,
        body: typeof this.config.message === 'function' ? this.config.message(ctx) : (this.config.message || {
          error: 'Too Many Requests',
          message: 'Rate limit exceeded, retry later.',
          statusCode: 429
        })
      };
    }

    return {
      allowed: result.allowed,
      blocked: !result.allowed,
      headers,
      response
    };
  }
}
