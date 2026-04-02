// Express adapter
import { Request, Response, NextFunction } from 'express';
import { Limiter } from '../core/limiter.js';
import { createRateLimiter, isLimiterInstance } from '../factory/createLimiter.js';
import type { RateLimiterConfig, RateLimitContext } from '../types/index.js';

export const expressAdapter = (input: RateLimiterConfig | Limiter) => {
  if (!input) throw new Error("Rate limiter config required");
  const limiter = isLimiterInstance(input) ? input : createRateLimiter(input);

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx: RateLimitContext = {
        ip: req.ip,
        method: req.method,
        path: req.path,
        headers: req.headers,
        query: req.query,
        body: req.body,
        user: (req as any).user,
        route: req.route?.path || (req.baseUrl && req.path ? req.baseUrl + req.path : undefined) || 'unknown',
        raw: req
      };
      
      const result = await limiter.check(ctx);

      if (result.headers) {
        Object.entries(result.headers).forEach(([key, value]) => {
          res.setHeader(key, value as string);
        });
      }

      if (result.blocked && result.response) {
        return res.status(result.response.status || 429).json(result.response.body);
      }

      next();
    } catch (error) {
      if (!limiter.config.failStrategy || limiter.config.failStrategy === 'fail-open') {
         next();
      } else {
         next(error);
      }
    }
  };
};

export const rateLimiter = expressAdapter;
export const expressMiddleware = expressAdapter;
export const expressRateLimit = expressAdapter;
