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
