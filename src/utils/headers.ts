import type { RateLimitResult } from "../types/index.js";

export function buildRateLimitHeaders(
  result: RateLimitResult,
  limit: number
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
  };
  
  if (!result.allowed) {
    headers["Retry-After"] = String(result.reset - Math.floor(Date.now() / 1000));
  }
  
  return headers;
}
