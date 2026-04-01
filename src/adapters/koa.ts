// Koa adapter
import { Limiter } from '../core/limiter.js';
import { handleRateLimit } from '../core/handle.js';
import type { RateLimiterConfig, RateLimitContext } from '../types/index.js';

export interface KoaAdapterConfig extends Omit<RateLimiterConfig, 'limiter'> {
  redis?: any;
}

export const koaAdapter = (limiter: Limiter, config: KoaAdapterConfig = {}) => {
  return async (ctx: any, next: () => Promise<void>) => {
      const rateLimitCtx: RateLimitContext = {
        ip: ctx.ip || ctx.request.ip,
        method: ctx.method,
        path: ctx.path,
        headers: ctx.headers,
        query: ctx.query,
        body: ctx.request.body,
        user: ctx.state?.user,
        route: ctx._matchedRoute || ctx.path || 'unknown',
        raw: ctx,
      };

      const result = await handleRateLimit(rateLimitCtx, { limiter, ...config });

      if (result.headers) {
        Object.entries(result.headers).forEach(([key, value]) => {
          ctx.set(key, value);
        });
      }

      if (result.blocked && result.response) {
        ctx.status = result.response.status || 429;
        ctx.body = result.response.body;
        return;
      }

      await next();
  };
};
