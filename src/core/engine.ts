// src/core/engine.ts

import type {
  RateLimitContext,
  RateLimiterConfig,
  RateLimitResult,
  AlgorithmType
} from "../types/index.js";
import type { Store } from "../store/types.js";
import { defaultKeyGenerator } from "../utils/index.js";
import { resolvePolicy, CompiledPolicies } from "../policies/compiler.js";

export class Engine {
  private store: Store;
  private config: RateLimiterConfig;
  private compiledPolicies: CompiledPolicies;

  constructor(store: Store, config: RateLimiterConfig, compiledPolicies: CompiledPolicies) {
    this.store = store;
    this.config = config;
    this.compiledPolicies = compiledPolicies;
  }

  /**
   * Main execution entry
   */
  async check(ctx: RateLimitContext): Promise<{
    result: RateLimitResult;
    key: string;
    algorithm: AlgorithmType;
  }> {
    try {
      // 🔹 Lifecycle: Plugins - beforeRequest
      if (this.config.plugins) {
        for (const plugin of this.config.plugins) {
          await plugin.beforeRequest?.(ctx);
        }
      }

      // 🔹 Hook: onRequest
      this.config.hooks?.onRequest?.(ctx);

      // 🔹 Skip logic
      if (this.config.skip?.(ctx) || (ctx as any).__skipRateLimit) {
        return {
          result: {
            allowed: true,
            remaining: Infinity,
            reset: 0,
            totalHits: 0
          },
          key: "skipped",
          algorithm: "sliding-window"
        };
      }

      // 🔹 Resolve policy (WITH fallback)
      const policy = resolvePolicy(
        ctx,
        this.compiledPolicies,
        this.config.default as any
      );

      // 🔹 Resolve dynamic/static options
      const options =
        typeof policy.window === "function"
          ? {
              window: policy.window(ctx),
              max: (policy.max as any)(ctx),
              algorithm: policy.algorithm || "sliding-window",
              burst: policy.burst ? (policy.burst as any)(ctx) : undefined
            }
          : {
              window: policy.window || (this.config.default as any)?.window || 60,
              max: policy.max || (this.config.default as any)?.max || 100,
              algorithm: policy.algorithm || "sliding-window",
              burst: policy.burst
          } as any;

      // 🔹 Generate identifier
      const identifier =
        this.config.key?.(ctx) || defaultKeyGenerator(ctx);

      // 🔥 Normalize path (prevent Redis key explosion)
      const route =
        ctx.route ||
        ctx.path.replace(/\d+/g, ":id");

      const key = `${this.config.prefix || "rl:"}${identifier}:${ctx.method}:${route}`;

      // 🔹 Lifecycle: Plugins - beforeLimit
      if (this.config.plugins) {
        for (const plugin of this.config.plugins) {
          await plugin.beforeLimit?.(ctx, key);
        }
      }

      // 🔹 Execute store
      const result = await this.store.consume(
        key,
        options.window,
        options.max,
        options.algorithm,
        options.burst
      );

      // 🔹 Lifecycle: Plugins - afterLimit
      if (this.config.plugins) {
        for (const plugin of this.config.plugins) {
          await plugin.afterLimit?.(ctx, result);
        }
      }

      // 🔹 Hook: onLimit
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
        algorithm: options.algorithm || "sliding-window"
      };

    } catch (error) {
      // 🔹 Lifecycle: Plugins - onError
      if (this.config.plugins) {
        for (const plugin of this.config.plugins) {
          plugin.onError?.(error, ctx);
        }
      }

      // 🔹 Hook: onError
      this.config.hooks?.onError?.(error);

      if (!this.config.failStrategy || this.config.failStrategy === "fail-open") {
        return {
          result: {
            allowed: true,
            remaining: 0,
            reset: 0,
            totalHits: 0
          },
          key: "error-fallback",
          algorithm: "sliding-window"
        };
      }

      throw error;
    }
  }
}
