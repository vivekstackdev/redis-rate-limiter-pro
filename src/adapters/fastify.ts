// Fastify adapter
import { FastifyRequest, FastifyReply } from 'fastify';
import { Limiter } from '../core/limiter.js';
import { createRateLimiter, isLimiterInstance } from '../factory/createLimiter.js';
import type { RateLimiterConfig, RateLimitContext } from '../types/index.js';

export const fastifyAdapter = (input: RateLimiterConfig | Limiter) => {
  if (!input) throw new Error("Rate limiter config required");
  const limiter = isLimiterInstance(input) ? input : createRateLimiter(input);

  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx: RateLimitContext = {
        ip: request.ip,
        method: request.method,
        path: request.url,
        headers: request.headers,
        query: request.query,
        body: request.body,
        user: (request as any).user,
        route: request.routeOptions?.url || (request as any).routerPath || 'unknown',
        raw: { request, reply }
      };

      const result = await limiter.check(ctx);

      if (result.headers) {
        const headers = result.headers;
        for (const key in headers) {
          reply.header(key, String((headers as any)[key]));
        }
      }

      if (result.blocked && result.response) {
        reply.code(result.response.status || 429).send(result.response.body);
        return reply;
      }

    } catch (error) {
      if (!limiter.config.failStrategy || limiter.config.failStrategy === 'fail-open') {
        // Fail open, do nothing
      } else {
        throw error;
      }
    }
  };
};

export const fastifyRateLimit = fastifyAdapter;
export const fastifyPlugin = fastifyAdapter;
