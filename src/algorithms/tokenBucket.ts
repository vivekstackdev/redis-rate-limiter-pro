import { Redis } from 'ioredis';
import type { RateLimitResult } from '../types/index.js';

// Pre-bundled Lua script for edge runtime compatibility
// Source: src/lua/tokenBucket.lua
const luaScript = `
-- Token Bucket Lua Script
-- KEYS[1] = key
-- ARGV[1] = now
-- ARGV[2] = maxTokens
-- ARGV[3] = refillRate (tokens per second)
-- ARGV[4] = window (for TTL calculation)

local key = KEYS[1]
local now = tonumber(ARGV[1])
local maxTokens = tonumber(ARGV[2])
local refillRate = tonumber(ARGV[3])
local window = tonumber(ARGV[4]) or 60

-- Get current state
local data = redis.call('HMGET', key, 'tokens', 'lastRefill')
local tokens = tonumber(data[1]) or maxTokens
local lastRefill = tonumber(data[2]) or now

-- Calculate token refill
local elapsed = (now - lastRefill) / 1000  -- Convert to seconds
tokens = math.min(maxTokens, tokens + elapsed * refillRate)

-- Check if we have tokens
if tokens < 1 then
  -- No tokens available
  local resetTime = math.ceil((now + ((1 - tokens) / refillRate) * 1000) / 1000)
  return {0, math.floor(tokens), resetTime}
end

-- Consume token
tokens = tokens - 1

-- Update state
redis.call('HMSET', key, 'tokens', tostring(tokens), 'lastRefill', tostring(now))

-- Set dynamic TTL based on window (Task 1.3)
local ttl = math.ceil(window * 2)  -- 2x window to ensure key persists long enough
redis.call('EXPIRE', key, ttl)

return {1, math.floor(tokens), math.ceil((now + 1000) / 1000)}
`;

let scriptSha: string | null = null;

/**
 * Preload the Lua script into Redis for better performance
 */
export const preloadScript = async (redis: Redis): Promise<string> => {
  if (!scriptSha) {
    scriptSha = (await redis.script('LOAD', luaScript)) as string;
  }
  return scriptSha;
};

export const tokenBucket = async (
  redis: Redis,
  key: string,
  window: number,
  max: number,
  burst?: number
): Promise<RateLimitResult> => {
  const now = Date.now();
  const refillRate = max / window;
  // Use burst if provided, otherwise use max
  const effectiveMax = burst || max;

  let result: any;

  try {
    if (scriptSha) {
      result = await redis.evalsha(scriptSha, 1, key, now, effectiveMax, refillRate, window);
    } else {
      scriptSha = (await redis.script('LOAD', luaScript)) as string;
      result = await redis.evalsha(scriptSha, 1, key, now, effectiveMax, refillRate, window);
    }
  } catch (error: any) {
    if (error.code === 'NOSCRIPT') {
      scriptSha = (await redis.script('LOAD', luaScript)) as string;
      result = await redis.evalsha(scriptSha, 1, key, now, effectiveMax, refillRate, window);
    } else {
      throw error;
    }
  }

  const [allowed, remaining, reset] = result as [number, number, number];

  return {
    allowed: allowed === 1,
    remaining,
    reset,
    totalHits: effectiveMax - remaining,
  };
};
