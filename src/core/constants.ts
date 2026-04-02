/**
 * Centralized constants for Redis Rate Limiter Pro
 * 
 * These values control performance tuning, resource cleanup, and retry strategies.
 */

// MemoryStore Configuration
export const DEFAULT_MAX_STORE_ENTRIES = 50_000;
export const CLEANUP_INTERVAL_MS = 60_000; // 1 minute
export const PRUNING_BATCH_SIZE = 1_000;

// RedisStore Configuration
export const REDIS_DEFAULT_TIMEOUT_MS = 1_000;
export const REDIS_RETRY_LIMIT = 1; // Fail-fast: Max 1 retry (total 2 attempts)
export const REDIS_RETRY_BACKOFF_MS = 100;
export const REDIS_MAX_BACKOFF_MS = 1_000;
export const REDIS_CIRCUIT_BREAKER_INTERVAL_MS = 2_000; // 2 seconds

// Engine Configuration
export const PATH_CACHE_SIZE_LIMIT = 1_000; // Limit to prevent memory growth

// HTTP Configuration
export const DEFAULT_RATE_LIMIT_STATUS = 429;
export const IP_HEADER_NAMES = [
  'x-forwarded-for',
  'x-real-ip',
  'cf-connecting-ip',
  'true-client-ip',
  'x-client-ip'
];
