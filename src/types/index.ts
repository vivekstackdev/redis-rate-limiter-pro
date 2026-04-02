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
  algorithm?: AlgorithmType;
  mode?: 'accurate' | 'fast';
  failStrategy?: 'fail-open' | 'fail-closed' | 'fallback-to-memory';
  store?: 'redis' | 'memory' | 'hybrid' | any; // Store interface handled via adapters or default memory
  redis?: any; // Redis client instance
  policies?: RateLimitRule[];
  default?: RateLimitDefaultConfig | RateLimitRule;
  hooks?: RateLimiterHooks;
  plugins?: RateLimiterPlugin[];
  layers?: any[];
  message?: any | ((ctx: RateLimitContext) => any);
}

/**
 * Rate Limit Result
 * 
 * Returned after checking rate limit status
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** The maximum number of requests allowed in this window */
  limit: number;
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
  window: number | ((ctx: RateLimitContext) => number);
  max: number | ((ctx: RateLimitContext) => number);
  algorithm?: AlgorithmType;
  burst?: number;
  mode?: 'accurate' | 'fast';
}

/**
 * Rate limit rule for advanced configuration
 */
export interface RateLimitRule {
  path?: string | RegExp;
  prefix?: string;
  method?: string;
  window?: number | ((ctx: RateLimitContext) => number);
  max?: number | ((ctx: RateLimitContext) => number);
  options?: {
    window?: number | ((ctx: RateLimitContext) => number);
    max?: number | ((ctx: RateLimitContext) => number);
  };
  match?: (ctx: RateLimitContext) => boolean;
  algorithm?: AlgorithmType;
  burst?: number;
  mode?: 'accurate' | 'fast';
  adaptive?: AdaptiveConfig;
}

/**
 * Adaptive Rate Limiting Config
 */
export interface AdaptiveConfig {
  enabled: boolean;
  strategy?: 'auto-scale'; // more in future
  rules?: {
    spikeThreshold: number;   // detect sudden spike
    reduceLimitBy: number;    // reduce limits during spike (percentage, e.g. 50 means 50%)
    recoveryTime: number;     // recover after xs
  };
}

/**
 * Algorithm type selector
 */
export type AlgorithmType = 'sliding-window' | 'token-bucket' | 'fixed-window';

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
  onRequest?: (ctx: RateLimitContext) => void;
  onLimit?: (ctx: RateLimitContext, info: RateLimitInfo) => void;
  onError?: (error: unknown) => void;
}

/**
 * Multi-layer rate limit result (for hierarchical limits)
 */
export interface MultiLayerRateLimitResult {
  allowed: boolean;
  limit?: number;
  remaining?: number;
  reset?: number;
  layers?: RateLimitResult[];
}
