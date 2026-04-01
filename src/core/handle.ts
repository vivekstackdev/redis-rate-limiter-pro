// Core rate limiting handler
import type { RateLimitContext, RateLimiterConfig, RateLimitRule, RateLimiterPlugin } from '../types/index.js';
import { Limiter } from './limiter.js';

export interface HandlerResult {
  allowed?: boolean;
  blocked?: boolean;
  result?: any;
  headers?: Record<string, string>;
  response?: {
    status?: number;
    body?: any;
  };
}

export interface AdapterConfig extends RateLimiterConfig {
  limiter: Limiter;
  rules?: RateLimitRule[];
  plugins?: RateLimiterPlugin[];
  onLimit?: (ctx: RateLimitContext, result: any) => any;
  headers?: boolean | {
    standard?: boolean;
    legacy?: boolean;
    custom?: (ctx: RateLimitContext, result: any) => Record<string, string>;
  };
  hooks?: any;
  failOpen?: boolean;
}

// Run plugin hooks
async function runPlugins(plugins: RateLimiterPlugin[] = [], fn: (p: RateLimiterPlugin) => any) {
  const tasks: Promise<any>[] = [];

  for (const plugin of plugins) {
    try {
      const result = fn(plugin);
      if (result && typeof (result as any).then === 'function') {
        tasks.push(result);
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[Plugin Error: ${plugin.name || 'anonymous'}]`, err);
      }
    }
  }

  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
}

/**
 * Compile rules once at initialization for better performance
 * Call this when setting up rate limiter config
 */
export function compileRules(rules: RateLimitRule[]): ReadonlyArray<RateLimitRule> {
  // Rules are already compiled - this is a marker for optimization
  // In future, could pre-compute static values here
  return Object.freeze(rules);
}

// Resolve matching rule (fast path → prefix → dynamic)
function resolveRule(ctx: RateLimitContext, rules: RateLimitRule[], fallback: { window: number; max: number }): RateLimitRule {
  const path = ctx.path;

  // Fast path: exact match
  for (const rule of rules) {
    if (rule.path && rule.path === path) return rule;
  }

  // Prefix match
  for (const rule of rules) {
    if (rule.prefix && path.startsWith(rule.prefix)) return rule;
  }

  // Dynamic match
  for (const rule of rules) {
    if (rule.match && rule.match(ctx)) return rule;
  }

  return fallback;
}

// Core rate limiting handler
export async function handleRateLimit(
  ctx: RateLimitContext,
  config: AdapterConfig
): Promise<HandlerResult> {
  const {
    limiter,
    window = 60,
    max = 100,
    key,
    skip,
    rules = [],
    plugins = [],
    onLimit,
    headers,
    hooks,
    failOpen,
    prefix = 'rl:',
  } = config;

  try {
    // 🧠 1. Plugin: beforeRequest
    await runPlugins(plugins, (p) => p.beforeRequest?.(ctx));

    // Skip / Block flags from plugins
    if ((ctx as any).__skip || skip?.(ctx)) {
      return { allowed: true };
    }

    if ((ctx as any).__blocked) {
      return {
        blocked: true,
        response: { status: 403, body: { message: 'Access denied' } },
      };
    }

    // 🧠 2. Resolve rule
    const rule = resolveRule(ctx, rules, { window, max });

    const windowValue = typeof rule.window === 'function' ? rule.window(ctx) : rule.window;
    const maxValue = typeof rule.max === 'function' ? rule.max(ctx) : rule.max;

    // 🧠 3. Generate key (optimized string concatenation with base caching)
    const identifier = key ? key(ctx) : ctx.ip || 'anonymous';
    const route = ctx.route || ctx.path;
    
    // Micro-optimization: cache base prefix+identifier for repeated use
    const baseKey = prefix + identifier;
    const rateLimitKey = baseKey + ':' + ctx.method + ':' + route;

    // 🧠 4. Plugin: beforeLimit
    await runPlugins(plugins, (p) => p.beforeLimit?.(ctx, rateLimitKey));

    // ⚡ 5. Core limiter
    const result = await limiter.consume(
      rateLimitKey,
      windowValue,
      maxValue,
      rule.algorithm,
      rule.burst
    );

    // 🧠 6. Plugin: afterLimit
    await runPlugins(plugins, (p) => p.afterLimit?.(ctx, result));

    // Enrich result with limit info (only when needed)
    let enriched: any;
    const needsEnrichment = !result.allowed || hooks || onLimit;
    
    if (needsEnrichment) {
      enriched = {
        ...result,
        limit: maxValue,
        key: rateLimitKey,
        algorithm: rule.algorithm || 'sliding-window',
      };
    }

    // Handle blocked request
    if (!result.allowed) {
      hooks?.onLimitReached?.(ctx.raw, enriched);

      // Custom response handler
      if (onLimit) {
        const customResponse = onLimit(ctx, enriched);
        return { blocked: true, response: customResponse };
      }

      // Default response (no JSON.stringify - let adapter handle it)
      return {
        blocked: true,
        response: {
          status: 429,
          body: {
            success: false,
            message: 'Too many requests',
            retryAfter: result.reset,
          },
        },
      };
    }

    // Request allowed
    hooks?.onRequestAllowed?.(ctx.raw, enriched);

    // Build headers if enabled (optimized creation using Object.create)
    let headerObj: Record<string, string> | undefined;
    
    if (headers !== false) {
      // Use Object.create for faster object creation than {}
      headerObj = Object.create(null);
      
      // Standard headers
      if (typeof headers === 'object' && headers.standard !== false) {
        headerObj!['RateLimit-Limit'] = String(maxValue);
        headerObj!['RateLimit-Remaining'] = String(result.remaining);
        headerObj!['RateLimit-Reset'] = String(result.reset);
      }
      
      // Legacy X- headers
      if (typeof headers === 'object' && headers.legacy !== false) {
        headerObj!['X-RateLimit-Limit'] = String(maxValue);
        headerObj!['X-RateLimit-Remaining'] = String(result.remaining);
        headerObj!['X-RateLimit-Reset'] = String(result.reset);
      }

      // Custom headers
      if (typeof headers === 'object' && headers.custom) {
        const custom = headers.custom(ctx, enriched!);
        Object.assign(headerObj!, custom);
      }
    }

    return {
      allowed: true,
      result: enriched || result,
      headers: headerObj,
    };
  } catch (err) {
    // Error handling
    await runPlugins(plugins, (p) => p.onError?.(err, ctx));
    hooks?.onError?.(err, ctx);

    // Fail open - allow request on error
    if (failOpen) {
      return { allowed: true };
    }

    // Re-throw by default
    throw err;
  }
}
