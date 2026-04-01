/**
 * NestJS Guard for Rate Limiting
 * 
 * Professional NestJS integration using the framework-agnostic core engine
 */

import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Limiter } from '../../core/limiter.js';
import { handleRateLimit } from '../../core/handle.js';
import type { AdapterConfig } from '../../core/handle.js';
import type { RateLimitContext } from '../../types/index.js';

export interface NestJSGuardConfig {
  limiter: Limiter;
  config?: Omit<AdapterConfig, 'limiter'>;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly config: NestJSGuardConfig;

  constructor(@Inject('RATE_LIMIT_CONFIG') config: NestJSGuardConfig) {
    this.config = config;
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

    // Normalize to unified RateLimitContext
    const headers: Record<string, string> = {};
    Object.entries(request.headers).forEach(([key, value]) => {
      if (value !== undefined) {
        headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
      }
    });

    const rateLimitCtx: RateLimitContext = {
      ip: this.extractIP(request, headers),
      method: request.method,
      path: request.url,
      headers,
      query: request.query,
      body: request.body,
      user: request.user,
      raw: { request, response },
      framework: 'nestjs',
    } as RateLimitContext;

    try {
      const result = await handleRateLimit(rateLimitCtx, {
        limiter: this.config.limiter,
        ...this.config.config,
      });

      // Apply headers if present
      if (result.headers) {
        Object.entries(result.headers).forEach(([key, value]) => {
          response.setHeader(key, String(value));
        });
      }

      // If blocked, throw exception (NestJS will handle response)
      if (result.blocked && result.response) {
        response.status(result.response.status || 429);
        response.json(result.response.body);
        return false;
      }

      return true;
    } catch (error) {
      // Fail open by default (let request continue)
      if (!this.config.config?.failOpen) {
        throw error;
      }
      return true;
    }
  }

  private extractIP(req: any, headers: Record<string, string>): string | undefined {
    // Check X-Forwarded-For first (for proxied requests)
    const forwarded = headers['x-forwarded-for'];
    if (forwarded) {
      const ips = forwarded.split(',').map(ip => ip.trim());
      return ips[0];
    }

    // Fall back to direct IP
    return req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress;
  }
}
