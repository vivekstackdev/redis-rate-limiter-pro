// Hono adapter
import { Context } from 'hono';
import { Limiter } from '../core/limiter.js';
import { createRateLimiter, isLimiterInstance } from '../factory/createLimiter.js';
import type { RateLimiterConfig, RateLimitContext } from '../types/index.js';

export const honoAdapter = (input: RateLimiterConfig | Limiter) => {
  if (!input) throw new Error("Rate limiter config required");
  const limiter = isLimiterInstance(input) ? input : createRateLimiter(input);

  return async (c: Context, next: () => Promise<void>): Promise<Response | void> => {
    try {
      // ⚡ Optimized: Zero-copy lazy lookup for headers
      const headers = new Proxy({}, {
        get: (_, prop) => typeof prop === 'string' ? c.req.header(prop) : undefined
      }) as any;

      const ctx: RateLimitContext = {
        ip: c.req.header('x-forwarded-for')?.split(',')[0] || c.req.header('x-real-ip') || 'anonymous',
        method: c.req.method,
        path: c.req.path,
        headers,
        query: c.req.query(),
        body: (c as any).req?.body,
        user: (c as any).get('user'),
        route: (c as any).routePath || c.req.path || 'unknown',
        raw: c,
      };

      const result = await limiter.check(ctx);

      if (result.headers) {
        Object.entries(result.headers).forEach(([key, value]) => {
          c.header(key, String(value));
        });
      }

      if (result.blocked && result.response) {
        return c.json(result.response.body, { status: result.response.status as any || 429 });
      }

      await next();
    } catch (error) {
      if (!limiter.config.failStrategy || limiter.config.failStrategy === 'fail-open') {
        await next();
      } else {
        throw error;
      }
    }
  };
};

export const honoRateLimit = honoAdapter;
export const honoHandler = honoAdapter;
