// Express adapter
import { Request, Response, NextFunction } from 'express';
import { Limiter } from '../core/limiter.js';
import { handleRateLimit } from '../core/handle.js';
import type { RateLimiterConfig, RateLimitContext } from '../types/index.js';

export interface ExpressRateLimiterOptions extends Omit<RateLimiterConfig, 'limiter'> {
  redis?: any;
}

export const expressAdapter = (limiter: Limiter, config: ExpressRateLimiterOptions = {}) => {
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
      
      const result = await handleRateLimit(ctx, { limiter, ...config });

      if (result.headers) {
        Object.entries(result.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }

      if (result.blocked && result.response) {
        return res.status(result.response.status || 429).json(result.response.body);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Backward compatibility
export const rateLimiter = expressAdapter;
export const expressMiddleware = expressAdapter;
