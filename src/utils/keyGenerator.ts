import type { RateLimitContext } from '../types/index.js';
import { extractIPFromHeaders } from './ip.js';

// Get IP from RateLimitContext
export function getClientIP(ctx: RateLimitContext): string {
    // Direct IP (from framework's req.ip)
    if (ctx.ip) {
        return ctx.ip;
    }

    // Extract from headers
    const headerIP = extractIPFromHeaders(ctx.headers);
    if (headerIP) {
        return headerIP;
    }

    return 'anonymous';
}

// Default key generator - uses client IP
export const defaultKeyGenerator = (ctx: RateLimitContext): string => {
    return getClientIP(ctx);
};
