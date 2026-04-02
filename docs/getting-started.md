# 🚀 Getting Started

Quickly integrate **redis-rate-limiter-pro** into your Node.js application.

---

## 📦 Installation

```bash
npm install redis-rate-limiter-pro ioredis
```

---

## 🧠 Which mode should I use?

- **Memory** → Small apps, local development, single-server instances.
- **Redis** → Multi-server/distributed apps requiring shared rate limits.
- **Hybrid** → Production (recommended). Ensures zero downtime if Redis fails.

---

## 🚦 Basic Usage (Memory)

By default, the rate limiter works in-memory. Perfect for local development.

```js
import { expressRateLimit } from "redis-rate-limiter-pro/express";

const limiter = expressRateLimit({
  default: {
    window: 60, // seconds
    max: 100    // requests per window
  }
});

app.use(limiter);
```

---

## 🧠 Distributed Setup (Redis)

To share rate limits across multiple servers, use the **Redis Store**.

```js
import Redis from "ioredis";
import { expressRateLimit } from "redis-rate-limiter-pro/express";

const redis = new Redis();

const limiter = expressRateLimit({
  store: "redis",
  redis: redis,
  default: { window: 60, max: 1000 }
});

app.use(limiter);
```

---

## 🔥 Hybrid Mode (Recommended)

For mission-critical APIs, use **Hybrid Mode**. It uses Redis as the primary store but automatically falls back to local memory if Redis goes down.

```js
const limiter = expressRateLimit({
  store: "hybrid",
  redis: new Redis(),
  default: { window: 60, max: 1000 },
  failStrategy: "fallback-to-memory" // Zero downtime
});
```

---

## 🏗️ Simple vs. Advanced Usage

### Simple Usage
Pass a configuration object directly to the framework middleware.
```js
app.use(expressRateLimit({ default: { window: 60, max: 100 } }));
```

### Advanced Usage
Create a shared limiter instance using the factory for better control across multiple apps or adapters.
```js
import { createRateLimiter } from "redis-rate-limiter-pro";

const limiter = createRateLimiter({ ...config });
app.use(expressRateLimit(limiter));
```

---

## 🎯 Next Steps

- [x] Configure [Policies](https://github.com/vivekstackdev/redis-rate-limiter-pro/tree/main/docs/configuration.md)
- [ ] Read the [Production Guide](https://github.com/vivekstackdev/redis-rate-limiter-pro/tree/main/docs/production.md)
