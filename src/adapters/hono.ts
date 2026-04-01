// Hono adapter
import { Context } from 'hono';
import { Limiter } from '../core/limiter.js';
import { handleRateLimit } from '../core/handle.js';
import type { RateLimiterConfig, RateLimitContext } from '../types/index.js';

export interface HonoAdapterConfig extends Omit<RateLimiterConfig, 'limiter'> {
  redis?: any;
}

export const honoAdapter = (limiter: Limiter, config: HonoAdapterConfig = {}) => {
  return async (c: Context): Promise<Response | null> => {
    try {
      const headers: Record<string, string> = {};
      c.req.raw.headers.forEach((value: string, key: string) => {
        headers[key] = value;
      });

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

      const result = await handleRateLimit(ctx, { limiter, ...config });

      if (result.headers) {
        Object.entries(result.headers).forEach(([key, value]) => {
          c.header(key, value);
        });
      }

      if (result.blocked && result.response) {
        return c.json(result.response.body, { status: result.response.status as any || 429 });
      }

      return null;
    } catch (error) {
      console.error('[HonoRateLimiter Error]', error);
      throw error;
    }
  };
};

// Alias
export const honoHandler = honoAdapter;
