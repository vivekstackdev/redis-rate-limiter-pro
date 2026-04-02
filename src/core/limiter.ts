import type { RateLimitContext, RateLimiterConfig } from '../types/index.js';
import { Engine } from './engine.js';
import { compilePolicies } from '../policies/compiler.js';
import { MemoryStore } from '../store/memoryStore.js';
import type { Store } from '../store/types.js';

/**
 * Main entry point for the Redis Rate Limiter Pro library.
 * Orchesrates between policies, engine, and response formatting.
 */
export class Limiter {
  public store: Store;
  public config: RateLimiterConfig;
  private engine: Engine;

  constructor(config: RateLimiterConfig) {
    this.config = config;
    this.store = config.store || new MemoryStore();

    const compiledPolicies = compilePolicies(config.policies);
    this.engine = new Engine(this.store, this.config, compiledPolicies);
  }

  /**
   * Check rate limit for the given context.
   * Handles individual checks and hierarchical multi-layer checks.
   */
  async check(ctx: RateLimitContext) {
    //  Guard: Skip logic
    if (this.config.skip && this.config.skip(ctx)) {
      return { allowed: true, headers: {} };
    }

    let checkResult;

    //  Execution: Multi-layer vs Single-check
    if (this.config.layers && this.config.layers.length > 0) {
      checkResult = await this.engine.executeLayers(ctx, this.config.layers);
    } else {
      const resultObj = await this.engine.check(ctx);
      checkResult = {
        allowed: resultObj.result.allowed,
        limit: (resultObj as any).limit,
        remaining: resultObj.result.remaining,
        reset: resultObj.result.reset
      };
    }

    const headers = this.deriveHeaders(checkResult);

    //  Response Formatting: 429 Too Many Requests
    let response = null;
    if (!checkResult.allowed) {
      response = {
        status: 429,
        body: this.resolveErrorMessage(ctx)
      };
    }

    return {
      allowed: checkResult.allowed,
      blocked: !checkResult.allowed,
      headers,
      response
    };
  }

  /**
   * Derive standardized headers from rate limit results.
   * Ensures Retry-After is a positive integer.
   */
  private deriveHeaders(result: { allowed: boolean; limit?: number; remaining?: number; reset?: number }) {
    const headers: Record<string, string> = Object.create(null);

    if (result.limit !== undefined) {
      headers['X-RateLimit-Limit'] = String(result.limit);
    }

    if (result.remaining !== undefined) {
      headers['X-RateLimit-Remaining'] = String(result.remaining);
    }

    if (result.reset !== undefined) {
      headers['X-RateLimit-Reset'] = String(result.reset);

      //  Retry-After (Required for 429)
      if (!result.allowed) {
        const nowInSeconds = Math.floor(Date.now() / 1000);
        // Ensure Retry-After is at least 1 second and never negative
        const retryAfter = Math.max(1, result.reset - nowInSeconds);
        headers['Retry-After'] = String(retryAfter);
      }
    }

    return headers;
  }

  /**
   * Resolve error message based on config (static or dynamic).
   */
  private resolveErrorMessage(ctx: RateLimitContext) {
    if (typeof this.config.message === 'function') {
      return this.config.message(ctx);
    }

    return this.config.message || {
      error: 'Too Many Requests',
      message: 'Rate limit exceeded, retry later.',
      statusCode: 429
    };
  }
}
