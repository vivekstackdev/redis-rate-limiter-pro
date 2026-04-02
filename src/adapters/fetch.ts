// Fetch API adapter - works with Bun, Deno, Cloudflare Workers, Next.js Edge
import { Limiter } from '../core/limiter.js';
import { createRateLimiter, isLimiterInstance } from '../factory/createLimiter.js';
import type { RateLimiterConfig, RateLimitContext } from '../types/index.js';

export const fetchRateLimiter = (input: RateLimiterConfig | Limiter) => {
  if (!input) throw new Error("Rate limiter config required");
  const limiter = isLimiterInstance(input) ? input : createRateLimiter(input);

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

      const result = await limiter.check(ctx);

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

      return null; // OK
    } catch (error) {
      if (!limiter.config.failStrategy || limiter.config.failStrategy === 'fail-open') {
         return null;
      }
      throw error;
    }
  };
};

export const fetchRateLimit = fetchRateLimiter;
