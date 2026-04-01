// Fetch API adapter - works with Bun, Deno, Cloudflare Workers, Next.js Edge
import { Limiter } from '../core/limiter.js';
import { handleRateLimit } from '../core/handle.js';
import type { RateLimiterConfig, RateLimitContext } from '../types/index.js';

export interface FetchRateLimiterOptions extends Omit<RateLimiterConfig, 'limiter'> {
  redis?: any;
}

export const fetchRateLimiter = (limiter: Limiter, config: FetchRateLimiterOptions = {}) => {
  return async (request: Request): Promise<Response | null> => {
    try {
      const url = new URL(request.url);
      const headers: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        headers[key] = value;
      });

      const ctx: RateLimitContext = {
        ip: request.headers.get('x-forwarded-for')?.split(',')[0] || 
            request.headers.get('x-real-ip') || 
            'anonymous',
        method: request.method,
        path: url.pathname,
        headers,
        raw: request,
      };

      const result = await handleRateLimit(ctx, { limiter, ...config });

      const responseInit: ResponseInit = {};
      if (result.headers) {
        responseInit.headers = result.headers;
      }

      if (result.blocked && result.response) {
        return new Response(JSON.stringify(result.response.body), {
          status: result.response.status || 429,
          headers: responseInit.headers,
        });
      }

      return null;
    } catch (error) {
      console.error('[FetchRateLimiter Error]', error);
      throw error;
    }
  };
};

// Alias for Hono
export const honoRateLimiter = fetchRateLimiter;
