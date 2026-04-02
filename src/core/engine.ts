import type {
  RateLimitContext,
  RateLimiterConfig,
  RateLimitResult,
  AlgorithmType,
  RateLimitRule,
  RateLimitDefaultConfig,
  MultiLayerRateLimitResult
} from "../types/index.js";
import type { Store } from "../store/types.js";
import { defaultKeyGenerator } from "../utils/index.js";
import { resolvePolicy, CompiledPolicies } from "../policies/compiler.js";
import { PATH_CACHE_SIZE_LIMIT } from "./constants.js";

const PATH_REGEX = /\d+/g;

/**
 * Core execution engine for Redis Rate Limiter Pro.
 * Handles policy resolution, key generation, and hierarchical layering.
 */
export class Engine {
  private store: Store;
  private config: RateLimiterConfig;
  private compiledPolicies: CompiledPolicies;
  private pathCache = new Map<string, string>();

  constructor(store: Store, config: RateLimiterConfig, compiledPolicies: CompiledPolicies) {
    this.store = store;
    this.config = config;
    this.compiledPolicies = compiledPolicies;
  }

  /**
   * Normalize path with caching to prevent expensive regex operations at scale.
   * Includes a size limit to prevent memory exhaustion (LRU-lite).
   */
  private normalizePath(path: string): string {
    const cached = this.pathCache.get(path);
    if (cached) return cached;

    const normalized = path.replace(PATH_REGEX, ":id");

    // Protection against cache-busting memory growth
    if (this.pathCache.size < PATH_CACHE_SIZE_LIMIT) {
      this.pathCache.set(path, normalized);
    }

    return normalized;
  }

  /**
   * Execute multiple rate limit layers sequentially (Fail-Fast).
   * Returns the strictest constraint across all layers.
   */
  public async executeLayers(
    ctx: RateLimitContext,
    layers: RateLimitRule[]
  ): Promise<MultiLayerRateLimitResult> {
    const results: RateLimitResult[] = [];

    let mergedLimit = Infinity;
    let mergedRemaining = Infinity;
    let mergedReset = 0;

    for (const rule of layers) {
      // For layering, we pass the rule as the policy
      const { result } = await this.innerCheck(ctx, rule);
      results.push(result);

      // 🚀 Early Exit: If any layer blocks, we stop immediately
      if (!result.allowed) {
        return {
          allowed: false,
          limit: result.limit,
          remaining: result.remaining,
          reset: result.reset,
          layers: results
        };
      }

      // Merge constraints: Strictest limit, strictest remaining, longest reset
      mergedLimit = Math.min(mergedLimit, result.limit);
      mergedRemaining = Math.min(mergedRemaining, result.remaining);
      mergedReset = Math.max(mergedReset, result.reset);
    }

    return {
      allowed: true,
      limit: mergedLimit,
      remaining: mergedRemaining,
      reset: mergedReset,
      layers: results
    };
  }

  /**
   * Main execution entry for a single check.
   */
  public async check(ctx: RateLimitContext): Promise<{
    result: RateLimitResult;
    key: string;
    algorithm: AlgorithmType;
    limit: number;
  }> {
    const defaultRule = this.config.default as RateLimitDefaultConfig;
    const policy = resolvePolicy(ctx, this.compiledPolicies, defaultRule);

    return this.innerCheck(ctx, policy);
  }

  /**
   * Internal logic for checking a specific policy/rule.
   */
  private async innerCheck(
    ctx: RateLimitContext,
    policy: RateLimitRule
  ): Promise<{
    result: RateLimitResult;
    key: string;
    algorithm: AlgorithmType;
    limit: number;
  }> {
    try {
      const config = this.config;
      const plugins = config.plugins;
      const hasPlugins = plugins && plugins.length > 0;

      //  Lifecycle: beforeRequest
      if (hasPlugins) {
        for (let i = 0; i < plugins.length; i++) {
          await plugins[i]!.beforeRequest?.(ctx);
        }
      }

      // ⚡ Early Exit: Moving skip guard here allows plugins to set skip markers
      if (config.skip?.(ctx) || (ctx as any).__skipRateLimit) {
        return this.createSkippedResult();
      }

      //  Hook: onRequest
      config.hooks?.onRequest?.(ctx);

      //  Resolve configuration (Dynamic vs Static)
      const options = this.resolveOptions(ctx, policy);

      //  Generate identifier and key
      const prefix = config.prefix || "rl:";
      const identifier = config.key?.(ctx) || defaultKeyGenerator(ctx);
      const method = ctx.method; // assume already normalized/uppercase
      const route = ctx.route || this.normalizePath(ctx.path);

      // ⚡ String concatenation (+) is faster than template strings in v8 hot paths
      const key = prefix + identifier + ":" + method + ":" + route;

      //  Lifecycle: beforeLimit
      if (hasPlugins) {
        for (let i = 0; i < plugins.length; i++) {
          await plugins[i].beforeLimit?.(ctx, key);
        }
      }

      //  Execution: Store interaction
      const result = await this.store.consume(
        key,
        options.window,
        options.max,
        options.algorithm,
        options.burst
      );

      //  Lifecycle: afterLimit
      if (hasPlugins) {
        for (let i = 0; i < plugins.length; i++) {
          await plugins[i].afterLimit?.(ctx, result);
        }
      }

      //  Hook: onLimit (Failure only)
      if (!result.allowed) {
        this.config.hooks?.onLimit?.(ctx, {
          key,
          limit: options.max,
          remaining: result.remaining,
          reset: result.reset,
          totalHits: result.totalHits
        });
      }

      return {
        result,
        key,
        algorithm: options.algorithm,
        limit: options.max
      };

    } catch (error) {
      return this.handleError(error, ctx);
    }
  }

  /**
   * Resolves window/max options, handling functional vs static definitions.
   */
  private resolveOptions(ctx: RateLimitContext, policy: RateLimitRule) {
    const defaultRule = (this.config.default || {}) as RateLimitDefaultConfig;

    const resolve = (val: any, fallback: any) =>
      typeof val === 'function' ? val(ctx) : (val ?? fallback);

    return {
      window: resolve(policy.window, defaultRule.window || 60),
      max: resolve(policy.max, defaultRule.max || 100),
      algorithm: policy.algorithm || defaultRule.algorithm || "sliding-window",
      burst: resolve(policy.burst, defaultRule.burst)
    };
  }

  private createSkippedResult() {
    return {
      result: { allowed: true, limit: Infinity, remaining: Infinity, reset: 0, totalHits: 0 },
      key: "skipped",
      algorithm: "sliding-window" as AlgorithmType,
      limit: Infinity
    };
  }

  private async handleError(error: any, ctx: RateLimitContext) {
    //  Lifecycle/Hook: Error reporting
    const plugins = this.config.plugins;
    if (plugins && plugins.length > 0) {
      for (let i = 0; i < plugins.length; i++) {
        plugins[i].onError?.(error, ctx);
      }
    }
    this.config.hooks?.onError?.(error);

    //  Strategy: Fail-Open fallback
    if (!this.config.failStrategy || this.config.failStrategy === "fail-open") {
      return {
        result: { allowed: true, limit: 0, remaining: 0, reset: 0, totalHits: 0 },
        key: "error-fallback",
        algorithm: "sliding-window" as AlgorithmType,
        limit: 0
      };
    }

    throw error;
  }
}
