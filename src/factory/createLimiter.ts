// src/factory/createLimiter.ts
import { Limiter } from "../core/limiter.js";
import { MemoryStore } from "../store/memoryStore.js";
import { RedisStore } from "../store/redisStore.js";
import { HybridStore } from "../store/hybridStore.js";
import type { RateLimiterConfig } from "../types/index.js";

export function createRateLimiter(config: RateLimiterConfig): Limiter {
  if (!config || !config.default) {
    throw new Error("createRateLimiter: 'default' config is required");
  }

  let store;

  // 🔹 Allow custom store injection
  if (typeof config.store === "object" && config.store?.consume) {
    store = config.store;
  }
  // 🔹 Built-in store types
  else if (config.store === "redis") {
    if (!config.redis) {
      throw new Error("Redis store requires 'redis' client");
    }
    store = new RedisStore(config.redis, { timeoutMs: 1000 });
  }
  else if (config.store === "hybrid") {
    if (!config.redis) {
      throw new Error("Hybrid store requires 'redis' client");
    }
    store = new HybridStore({
      redis: new RedisStore(config.redis, { timeoutMs: 1000 }),
      memory: new MemoryStore(),
      failStrategy: config.failStrategy || "fail-open"
    });
  }
  // 🔹 Default = memory
  else {
    store = new MemoryStore();
  }

  config.store = store; // Ensure config has instantiated store properly

  return new Limiter(config);
}

// 🔹 Helper: isLimiterInstance
export function isLimiterInstance(obj: any): obj is Limiter {
  return obj && typeof obj.check === "function";
}
