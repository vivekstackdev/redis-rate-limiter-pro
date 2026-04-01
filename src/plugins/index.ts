// Export all rate limiter plugins and lifecycle hooks
export { whitelistPlugin } from './whitelist.js';
export { blacklistPlugin } from './blacklist.js';

// Default hook implementations
import type { RateLimitContext, RateLimitInfo } from '../types/index.js';

// Log rate limit events to console
export const logHooks = {
  // Called when a request is allowed
  onRequestAllowed: (_ctx: RateLimitContext, info: RateLimitInfo) => {
    console.log(`[Rate Limit] Allowed: ${info.key} (${info.remaining} remaining)`);
  },

  /**
   * Called when rate limit is exceeded
   */
  onLimitReached: (_ctx: RateLimitContext, info: RateLimitInfo) => {
    console.warn(`[Rate Limit] Exceeded: ${info.key} (limit: ${info.limit})`);
  },

  /**
   * Called when an error occurs
   */
  onError: (error: unknown, _ctx: RateLimitContext) => {
    console.error('[Rate Limit] Error:', error);
  },
};

/**
 * No-op hooks (for disabling logging)
 */
export const silentHooks = {
  onRequestAllowed: () => {},
  onLimitReached: () => {},
  onError: () => {},
};
