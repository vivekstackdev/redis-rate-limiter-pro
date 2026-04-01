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
