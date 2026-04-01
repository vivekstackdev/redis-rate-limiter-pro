# 🚀 redis-rate-limiter-pro

Production-grade distributed rate limiter for Node.js and Edge runtimes.

⚡ Sliding window (accurate)
🔥 Token bucket (burst handling)
🌍 Works with Express, Fastify, Koa, Hono, Fetch, NestJS
🧠 Redis-powered + memory fallback

---

## 📦 Installation

```bash
npm install redis-rate-limiter-pro ioredis
```

---

## ⚡ Quick Start

```ts
import { Limiter } from 'redis-rate-limiter-pro'
import { expressAdapter } from 'redis-rate-limiter-pro/express'
import Redis from 'ioredis'

const redis = new Redis()
const limiter = new Limiter(redis)

app.use(expressAdapter(limiter, {
  default: { window: 60, max: 100 }
}))
```

---

## 🧠 Core Concept

* Core → framework-agnostic engine
* Adapters → framework bindings
* Plugins → extensibility layer
* Redis + Lua → atomic operations

---

## ⚙️ Basic Configuration

```ts
{
  default: { window: 60, max: 100 },
  key: (ctx) => ctx.ip,
  headers: true
}
```

---

## 🔌 Adapters

```ts
expressAdapter(...)
fastifyAdapter(...)
koaAdapter(...)
honoAdapter(...)
fetchAdapter(...)
```

---

## 🧠 Rules

```ts
rules: [
  { path: '/login', window: 60, max: 5 },
  { prefix: '/api', window: 60, max: 100 }
]
```

---

## 🔌 Plugins

```ts
plugins: [
  whitelistPlugin(['127.0.0.1']),
  blacklistPlugin(['1.2.3.4'])
]
```

---

## ⚠️ Important

This is **application-level rate limiting**.

Use reverse proxies (NGINX, Traefik, etc.) for:

* global traffic limiting
* DDoS protection

---

## 📚 Documentation

- 📖 [Full Guide](https://github.com/vivekstackdev/redis-rate-limiter-pro/blob/main/docs/guide.md)
- 🚀 [Advanced Usage](https://github.com/vivekstackdev/redis-rate-limiter-pro/blob/main/docs/advanced.md)
---

## 📊 Performance

* ~30k req/sec (local benchmark)
* ~6ms p99 latency

---

## 🏆 License

MIT