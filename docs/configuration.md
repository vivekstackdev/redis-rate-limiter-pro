# ⚙️ Configuration

Full documentation of all available options in **redis-rate-limiter-pro**.

---

## 🏗️ Options Array

| Property | Type | Description |
|---|---|---|
| `default` | `RateLimitRule` | The fallback limit for any request that doesn't match a policy. |
| `policies` | `RateLimitPolicy[]` | An array of specific route-based policies (path or prefix). |
| `layers` | `RateLimitLayer[]` | Multi-layer limits (e.g., global limit + user limit). |
| `store` | `"memory" \| "redis" \| "hybrid"` | The storage engine to use. |
| `redis` | `Redis \| RedisProxy` | An instance of ioredis to use with RedisStore. |
| `key` | `(ctx) => string` | A function to generate custom client identifiers (e.g., user ID). |
| `skip` | `(ctx) => boolean` | A function to skip rate limiting for specific requests. |
| `failStrategy` | `"fail-open" \| "fail-closed" \| "fallback-to-memory"` | Strategy to use if Redis becomes unreachable (default: `"fallback-to-memory"`). |
| `hooks` | `RateLimitHooks` | Lifecycle hooks (`onRequest`, `onLimit`, `onError`). |
| `plugins` | `RateLimitPlugin[]` | Modular plugins (e.g., `blacklist`, `whitelist`). |
| `prefix` | `string` | Optional prefix for all Redis keys (default: `"rl:"`). |

---

## 🎯 Algorithms

Choose the strategy that fits your use case.

```js
default: {
  window: 60,
  max: 100,
  algorithm: "sliding-window", // or "token-bucket" / "fixed-window"
  burst: 120 // only for token-bucket
}
```

---

## 🧱 Multi-Layer Limits (Layers)

Apply multiple limits to the same request.

```js
const limiter = createRateLimiter({
  layers: [
    { key: "global", max: 10000, window: 60 }, // Global server protection
    { key: (ctx) => ctx.user?.id, max: 100, window: 60 } // Per-user limit
  ]
});
```

---

## 🎯 Policies

Define rules for specific routes or prefixes.

```js
const limiter = createRateLimiter({
  policies: [
    { path: "/api/login", max: 5, window: 60, algorithm: "token-bucket" },
    { prefix: "/public", max: 500, window: 60 }
  ]
});
```

---

## 🧠 Custom Identification (Key)

Override the default client identifier (IP address) with your logic.

```js
const limiter = createRateLimiter({
  key: (ctx) => ctx.user?.id || ctx.ip
});
```

---

## 🚦 Skip Logic

Skip rate limiting for certain IPs or specific conditions.

```js
const limiter = createRateLimiter({
  skip: (ctx) => ctx.ip === "127.0.0.1" || ctx.path.startsWith("/internal")
});
```

---

## 📊 Hooks

Lifecycle hooks for observability and monitoring.

```js
const limiter = createRateLimiter({
  hooks: {
    onRequest: (ctx) => console.log(`Request from ${ctx.ip}`),
    onLimit: (ctx, result) => console.warn(`Limit reached for ${ctx.ip}!`),
    onError: (err) => console.error(`Limiter error: ${err}`),
  }
});
```

---

## 🧱 Full Configuration Example

```js
import { createRateLimiter } from "redis-rate-limiter-pro";
import Redis from "ioredis";

const limiter = createRateLimiter({
  store: "hybrid",
  redis: new Redis(),
  prefix: "rl:",

  default: {
    window: 60,
    max: 100,
    algorithm: "sliding-window"
  },

  policies: [
    { path: "/api/login", max: 5, window: 60 }
  ],

  layers: [
    { key: "global", max: 10000, window: 60 }
  ],

  key: (ctx) => ctx.user?.id || ctx.ip,

  skip: (ctx) => ctx.ip === "127.0.0.1",

  failStrategy: "fallback-to-memory",

  hooks: {
    onRequest: (ctx) => console.log("Request starting"),
    onLimit: (ctx, res) => console.warn("Rate limit reached"),
    onError: (err) => console.error("Limiter error:", err)
  }
});
```
