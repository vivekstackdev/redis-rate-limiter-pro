import { Redis } from 'ioredis';
import type { RateLimitResult } from '../types/index.js';

// Pre-bundled Lua script for edge runtime compatibility
// Source: src/lua/slidingWindow.lua
const luaScript = `
-- KEYS[1] = key
-- ARGV[1] = now
-- ARGV[2] = windowStart
-- ARGV[3] = window
-- ARGV[4] = max

local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowStart = tonumber(ARGV[2])
local window = tonumber(ARGV[3])
local max = tonumber(ARGV[4])

-- 1. Remove old entries outside the current window
redis.call("ZREMRANGEBYSCORE", key, 0, windowStart)

-- 2. Add new request with unique member
-- Using deterministic counter instead of math.random for replication safety
local counterKey = key .. ":counter"
local counter = redis.call("INCR", counterKey)
redis.call("EXPIRE", counterKey, window * 2) -- TTL for counter
local member = now .. "-" .. tostring(counter)
redis.call("ZADD", key, now, member)

-- 3. Count total requests in current window
local count = redis.call("ZCARD", key)

-- 4. Set expiry to prevent memory leaks
redis.call("EXPIRE", key, window)

-- 5. Return the count
return count
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

export const slidingWindow = async (
  redis: Redis,
  key: string,
  window: number,
  max: number
): Promise<RateLimitResult> => {
  const now = Date.now();
  const windowStart = now - window * 1000;

  let count: number;

  try {
    if (scriptSha) {
      count = (await redis.evalsha(
        scriptSha,
        1,
        key,
        now,
        windowStart,
        window,
        max
      )) as number;
    } else {
      const sha = (await redis.script('LOAD', luaScript)) as string;
      scriptSha = sha;
      count = (await redis.evalsha(sha, 1, key, now, windowStart, window, max)) as number;
    }
  } catch (error: any) {
    if (error.code === 'NOSCRIPT') {
      const sha = (await redis.script('LOAD', luaScript)) as string;
      scriptSha = sha;
      count = (await redis.evalsha(sha, 1, key, now, windowStart, window, max)) as number;
    } else {
      throw error;
    }
  }

  const allowed = count <= max;
  const remaining = Math.max(0, max - count);
  const reset = Math.ceil((now + window * 1000) / 1000);

  return {
    allowed,
    remaining,
    reset,
    totalHits: count,
  };
};
