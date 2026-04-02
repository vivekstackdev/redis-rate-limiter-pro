// Koa adapter
import { Limiter } from '../core/limiter.js';
import { createRateLimiter, isLimiterInstance } from '../factory/createLimiter.js';
import type { RateLimiterConfig, RateLimitContext } from '../types/index.js';

export const koaAdapter = (input: RateLimiterConfig | Limiter) => {
  if (!input) throw new Error("Rate limiter config required");
  const limiter = isLimiterInstance(input) ? input : createRateLimiter(input);

  return async (ctx: any, next: () => Promise<void>) => {
    try {
      const rateLimitCtx: RateLimitContext = {
        ip: ctx.ip || ctx.request.ip,
        method: ctx.method,
        path: ctx.path,
        headers: ctx.headers,
        query: ctx.query,
        body: ctx.request?.body,
        user: ctx.state?.user,
        route: ctx._matchedRoute || ctx.path,
        raw: ctx,
      };

      const result = await limiter.check(rateLimitCtx);

      if (result.headers) {
        const headers = result.headers;
        for (const key in headers) {
          ctx.set(key, String((headers as any)[key]));
        }
      }

      if (result.blocked && result.response) {
        ctx.status = result.response.status || 429;
        ctx.body = result.response.body;
        return;
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

export const koaRateLimit = koaAdapter;
