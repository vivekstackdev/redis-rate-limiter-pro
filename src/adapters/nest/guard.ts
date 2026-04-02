/**
 * NestJS Guard for Rate Limiting
 */
import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Limiter } from '../../core/limiter.js';
import { createRateLimiter, isLimiterInstance } from '../../factory/createLimiter.js';
import type { RateLimiterConfig, RateLimitContext } from '../../types/index.js';

export type NestJSGuardConfig = RateLimiterConfig | Limiter;

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly limiter: Limiter;

  constructor(@Inject('RATE_LIMIT_CONFIG') config: NestJSGuardConfig) {
    if (!config) throw new Error("Rate limiter config required");
    this.limiter = isLimiterInstance(config) ? config : createRateLimiter(config);
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return this.handleRateLimit(context);
  }

  private async handleRateLimit(executionContext: ExecutionContext): Promise<boolean> {
    const ctx = executionContext.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    // Normalize
    const headers: Record<string, string> = {};
    Object.entries(request.headers).forEach(([key, value]) => {
      if (value !== undefined) {
        headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
      }
    });

    const rateLimitCtx: RateLimitContext = {
      ip: this.extractIP(request, headers) || 'anonymous',
      method: request.method,
      path: request.url,
      headers,
      query: request.query,
      body: request.body,
      user: request.user,
      raw: { request, response },
    };

    try {
      const result = await this.limiter.check(rateLimitCtx);

      if (result.headers) {
        Object.entries(result.headers).forEach(([key, value]) => {
          response.setHeader(key, String(value));
        });
      }

      if (result.blocked && result.response) {
        response.status(result.response.status || 429).json(result.response.body);
        return false;
      }

      return true;
    } catch (error) {
      if (!this.limiter.config.failStrategy || this.limiter.config.failStrategy === 'fail-open') {
         return true;
      }
      throw error;
    }
  }

  private extractIP(req: any, headers: Record<string, string>): string | undefined {
    const forwarded = headers['x-forwarded-for'];
    if (forwarded) {
      const ips = forwarded.split(',').map(ip => ip.trim());
      return ips[0];
    }
    return req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress;
  }
}
