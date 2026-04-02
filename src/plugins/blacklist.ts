import type { RateLimiterPlugin, RateLimitContext } from '../types/index.js';
import { getClientIP } from '../utils/index.js';

/**
 * Blacklist Plugin
 *
 * Blocks requests from specified IP addresses.
 * Sets __skipRateLimit and __blocked flags for middleware to handle.
 *
 * @param ips - Array of IP addresses to blacklist
 * @returns Rate limiter plugin instance
 *
 * @example
 * ```typescript
 * app.use(rateLimiter({
 *   redis,
 *   default: { window: 60, max: 100 },
 *   plugins: [blacklistPlugin(['192.168.1.100', '10.0.0.50'])],
 * }));
 * 
 * // Add custom middleware after rate limiter to handle blocked requests
 * app.use((ctx, next) => {
 *   if ((ctx as any).__blocked) {
 *     return res.status(403).json({ success: false, message: 'Access denied' });
 *   }
 *   next();
 * });
 * ```
 */
export const blacklistPlugin = (ips: string[]): RateLimiterPlugin => {
  // Validate input to prevent security issues
  if (!Array.isArray(ips)) {
    throw new Error('IPs must be an array');
  }

  const validIps = ips.filter(ip => ip && typeof ip === 'string');

  if (validIps.length !== ips.length) {
    throw new Error('Invalid IP address detected in blacklist (empty or non-string values are not allowed)');
  }

  return {
    name: 'blacklist',

    beforeRequest: (ctx: RateLimitContext) => {
      const ip = getClientIP(ctx);
      // Safely check IP - skip if IP is not available
      if (ip === 'anonymous') return;

      // Check IP or custom identifier in header
      if (validIps.includes(ip) || validIps.includes(ctx.headers?.['x-user'] as string)) {
        // Set flags for middleware to detect and handle gracefully
        (ctx as any).__skipRateLimit = true;
        (ctx as any).__blocked = true;
      }
    },
  };
};
