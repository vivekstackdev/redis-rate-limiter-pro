/**
 * NestJS Decorator for Rate Limiting
 * 
 * Allows per-route rate limiting configuration
 */

import { SetMetadata, applyDecorators, UseGuards } from '@nestjs/common';
import { RateLimitGuard } from './guard.js';

export const RATE_LIMIT_CONFIG = 'RATE_LIMIT_CONFIG';

export interface RouteRateLimitConfig {
  window: number;  // seconds
  max: number;     // max requests
  key?: string | ((req: any) => string);
}

/**
 * Apply rate limiting to a route
 * 
 * @example
 * @RateLimit({ window: 60, max: 10 })
 * @Get('users')
 * getUsers() { ... }
 */
export function RateLimit(config: RouteRateLimitConfig) {
  return applyDecorators(
    SetMetadata(RATE_LIMIT_CONFIG, config),
    UseGuards(RateLimitGuard),
  );
}
