local key = KEYS[1]
local max = tonumber(ARGV[1])
local window = tonumber(ARGV[2])

local current = redis.call("GET", key)
if current and tonumber(current) >= max then
    return tonumber(current)
end

current = redis.call("INCR", key)
if tonumber(current) == 1 then
    redis.call("PEXPIRE", key, window * 1000)
end

return current
