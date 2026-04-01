// Fastify adapter
import type { FastifyRequest, FastifyReply } from 'fastify';
import { Limiter } from '../core/limiter.js';
import { handleRateLimit } from '../core/handle.js';
import type { RateLimiterConfig, RateLimitContext } from '../types/index.js';

export interface FastifyRateLimiterOptions extends Omit<RateLimiterConfig, 'limiter'> {
  redis?: any;
}

export const fastifyAdapter = (limiter: Limiter, config: FastifyRateLimiterOptions = {}) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx: RateLimitContext = {
        ip: request.ip,
        method: request.method,
        path: request.url.split('?')[0],
        headers: request.headers as any,
        query: request.query as any,
        body: request.body,
        user: (request as any).user,
        route: request.routeOptions?.url || request.url.split('?')[0] || 'unknown',
        raw: request
      };
      
      const result = await handleRateLimit(ctx, { limiter, ...config });

      if (result.headers) {
        Object.entries(result.headers).forEach(([key, value]) => {
          reply.header(key, value);
        });
      }

      if (result.blocked && result.response) {
        return reply.status(result.response.status || 429).send(result.response.body);
      }
    } catch (error) {
      console.error('[FastifyRateLimiter Error]', error);
    }
  };
};
