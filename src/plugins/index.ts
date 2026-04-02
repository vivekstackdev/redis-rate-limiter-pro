// Export all rate limiter plugins and lifecycle hooks
export { whitelistPlugin, whitelistPlugin as whitelist } from './whitelist.js';
export { blacklistPlugin, blacklistPlugin as blacklist } from './blacklist.js';

import type { RateLimitContext, RateLimitInfo } from '../types/index.js';

/**
 * Log rate limit events to console
 */
export const logHooks = {
  onRequest: (ctx: RateLimitContext) => {
    console.log(`[Rate Limit] Request: ${ctx.method} ${ctx.path} from ${ctx.ip}`);
  },
  onLimit: (ctx: RateLimitContext, info: RateLimitInfo) => {
    console.warn(`[Rate Limit] Exceeded: ${info.key} (limit: ${info.limit})`);
  },
  onError: (error: unknown) => {
    console.error('[Rate Limit] Error:', error);
  },
};
