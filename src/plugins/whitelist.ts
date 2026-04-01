import type { RateLimiterPlugin, RateLimitContext } from '../types/index.js';
import { getClientIP } from '../utils/index.js';

/**
 * Whitelist Plugin
 *
 * Skips rate limiting for specified IP addresses.
 * Sets __skipRateLimit flag on context which is checked by middleware.
 *
 * @param ips - Array of IP addresses to whitelist
 * @returns Rate limiter plugin instance
 *
 * @example
 * ```typescript
 * app.use(rateLimiter({
 *   redis,
 *   default: { window: 60, max: 100 },
 *   plugins: [whitelistPlugin(['127.0.0.1', '192.168.1.1'])],
 * }));
 * ```
 */
export const whitelistPlugin = (ips: string[]): RateLimiterPlugin => {
  // Validate input to prevent security issues
  if (!Array.isArray(ips)) {
    throw new Error('IPs must be an array');
  }
  
  const validIps = ips.filter(ip => ip && typeof ip === 'string');
  
  if (validIps.length !== ips.length) {
    throw new Error('Invalid IP address detected in whitelist (empty or non-string values are not allowed)');
  }
  
  return {
    name: 'whitelist',
  
    beforeRequest: (ctx: RateLimitContext) => {
      const ip = getClientIP(ctx);
      // Safely check IP - skip if IP is not available
      if (ip === 'anonymous') return;
      
      // Check IP or custom identifier in header
      if (validIps.includes(ip) || validIps.includes(ctx.headers?.['x-user'] as string)) {
        // Set flag to skip rate limiting
        (ctx as any).__skipRateLimit = true;
      }
    },
  };
};
