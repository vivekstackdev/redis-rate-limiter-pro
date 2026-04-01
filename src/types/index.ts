// Core rate limiter types

// Rate limit context - single source of truth for all adapters
export interface RateLimitContext {
  ip?: string;
  method: string;
  path: string;
  headers: Record<string, any>;
  query?: any;
  body?: any;
  user?: any;
  route?: string;
  raw: any;
}

// Rate limiter configuration
export interface RateLimiterConfig {
  window?: number;
  max?: number;
  key?: (ctx: RateLimitContext) => string;
  skip?: (ctx: RateLimitContext) => boolean;
  prefix?: string;
}

/**
 * Rate Limit Result
 * 
 * Returned after checking rate limit status
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of requests remaining in current window */
  remaining: number;
  /** Unix timestamp (seconds) when the rate limit resets */
  reset: number;
  /** Total number of requests in current window */
  totalHits: number;
}

/**
 * Plugin System Types
 */

/**
 * Rate limiter plugin interface
 */
export interface RateLimiterPlugin {
  name?: string;
  beforeRequest?: (ctx: RateLimitContext) => Promise<void> | void;
  beforeLimit?: (ctx: RateLimitContext, key: string) => Promise<void> | void;
  afterLimit?: (ctx: RateLimitContext, result: RateLimitResult) => Promise<void> | void;
  onError?: (error: unknown, ctx: RateLimitContext) => void;
}

/**
 * Default rate limit configuration
 */
export interface RateLimitDefaultConfig {
  window: number;
  max: number;
  algorithm?: 'sliding-window' | 'token-bucket';
  burst?: number;
}

/**
 * Rate limit rule for advanced configuration
 */
export interface RateLimitRule {
  path?: string | RegExp;
  prefix?: string;
  method?: string;
  window: number | ((ctx: RateLimitContext) => number);
  max: number | ((ctx: RateLimitContext) => number);
  match?: (ctx: RateLimitContext) => boolean;
  algorithm?: 'sliding-window' | 'token-bucket';
  burst?: number;
}

/**
 * Algorithm type selector
 */
export type AlgorithmType = 'sliding-window' | 'token-bucket';

/**
 * Rate limit information passed to hooks
 */
export interface RateLimitInfo {
  key: string;
  limit: number;
  remaining: number;
  reset: number;
  totalHits: number;
}

/**
 * Hooks for rate limiting lifecycle events
 */
export interface RateLimiterHooks {
  onRequestAllowed?: (req: any, info: RateLimitInfo) => void;
  onLimitReached?: (req: any, info: RateLimitInfo) => void;
  onError?: (error: unknown, req: any) => void;
}

/**
 * Multi-layer rate limit result (for hierarchical limits)
 */
export interface MultiLayerRateLimitResult {
  allowed: boolean;
  remaining?: number;
  reset?: number;
  layers?: RateLimitResult[];
}
