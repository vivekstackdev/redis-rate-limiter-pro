# 🚀 redis-rate-limiter-pro

[![npm](https://img.shields.io/npm/v/redis-rate-limiter-pro)](https://www.npmjs.com/package/redis-rate-limiter-pro)
[![downloads](https://img.shields.io/npm/dm/redis-rate-limiter-pro)](https://www.npmjs.com/package/redis-rate-limiter-pro)
[![license](https://img.shields.io/npm/l/redis-rate-limiter-pro)](https://www.npmjs.com/package/redis-rate-limiter-pro)

Production-ready **Redis rate limiter for Node.js, Express, Fastify, Koa, Hono, and Edge runtimes**.

👉 Works out of the box with zero config — scales to Redis when needed.

---

## 📈 Performance

- **MemoryStore**: ~1.4M req/s
- **RedisStore**: ~80k–95k req/s (environment dependent)
- **Concurrency**: 10,000 requests processed in ~130ms–350ms

✔ **Atomic Operations**: Built-in Lua scripts ensure no race conditions.
✔ **Accurate**: Sliding window accuracy even under high concurrency.
✔ **Lightweight**: Zero-dependency core (optional `ioredis` for distributed mode).

---

## 🔁 Zero Downtime (Hybrid Mode)

- **Fail-Open Resilience**: Redis failure → automatic fallback to local memory.
- **No Request Failures**: Your API stays up even if your Redis goes down.
- **Designed for Scale**: Perfect for mission-critical payment, auth, and SaaS APIs.

---

## 🔥 Why this over others?

- Works with ALL frameworks (Express, Fastify, Koa, Hono, Fetch, NestJS)
- Redis + Hybrid fallback (no downtime)
- O(1) route matching (fast at scale)
- Built-in Lua scripts (atomic, no race conditions)
- Dynamic + multi-layer limits

---

## 📦 Install

```bash
npm install redis-rate-limiter-pro
```

> ℹ️ Redis is optional. Install `ioredis` only if using Redis or Hybrid mode:
>
> ```bash
> npm install ioredis
> ```

---

## 🚀 Quick Start

```js
import { expressRateLimit } from "redis-rate-limiter-pro/express";

app.use(expressRateLimit({
  default: { window: 60, max: 100 }
}));
```

---

## 🌍 Framework Usage

### Express
```js
import { expressRateLimit } from "redis-rate-limiter-pro/express";
app.use(expressRateLimit(config));
```

### Fastify
```js
import { fastifyRateLimit } from "redis-rate-limiter-pro/fastify";
fastify.addHook("onRequest", fastifyRateLimit(config));
```

### Koa
```js
import { koaRateLimit } from "redis-rate-limiter-pro/koa";
app.use(koaRateLimit(config));
```

---

## 🏗 How it works

**Request** → **Adapter** → **Limiter** → **Engine** → **Store** → **Redis/Memory**

- **Adapter**: Framework integration (Express, Fastify, etc.)
- **Engine**: Applies rules, policies, and business logic.
- **Store**: Handles persistence (Redis, local Memory, or Hybrid).

---

## ⚙️ Defaults

- **Store**: Memory (default)
- **Algorithm**: Sliding Window
- **Key**: Client IP address
- **Prefix**: `rl:`

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

---

## 🧩 Advanced Features

- Multi-layer limits (global + user + route)
- Hooks (onRequest, onLimit, onError)
- Plugins (blacklist / whitelist)
- Custom key generation

---

## ⚙️ Redis

```js
import { createRateLimiter } from "redis-rate-limiter-pro";
import Redis from "ioredis";

const limiter = createRateLimiter({
  store: "redis",
  redis: new Redis(),
  default: { window: 60, max: 100 }
});
```

---

## 🔥 Hybrid Mode

```js
createRateLimiter({
  store: "hybrid",
  redis: new Redis(),
  default: { window: 60, max: 100 }
});
```

> Redis fails → fallback to memory

---

## 🎯 Policies

```js
policies: [
  { path: "/login", max: 5, window: 60 },
  { prefix: "/api", max: 200, window: 60 }
]
```

---

## 🧠 Dynamic Limits

```js
default: {
  window: 60,
  max: (ctx) => ctx.user?.plan === "pro" ? 1000 : 100
}
```

---

## 🌍 Frameworks

* Express
* Fastify
* Koa
* Hono
* Fetch
* NestJS

---

## 📊 Headers

```
X-RateLimit-Limit
X-RateLimit-Remaining
X-RateLimit-Reset
Retry-After
```

---

## 📚 Docs

*   [🚀 Getting Started](https://github.com/vivekstackdev/redis-rate-limiter-pro/tree/main/docs/getting-started.md)
*   [⚙️ Configuration](https://github.com/vivekstackdev/redis-rate-limiter-pro/tree/main/docs/configuration.md)
*   [🚀 Production Guide](https://github.com/vivekstackdev/redis-rate-limiter-pro/tree/main/docs/production.md)

---

## 🧪 Testing & Benchmark

```bash
node tests/stress.ts
node scripts/benchmark.ts
```

---

## 🧠 Use Cases

* Login / OTP protection
* API rate limiting
* Payment APIs
* Chat apps
* SaaS apps

---

## 🧾 License

MIT
