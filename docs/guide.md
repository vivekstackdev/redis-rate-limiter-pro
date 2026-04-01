# 📖 Full Guide

## 🧠 Overview

`redis-rate-limiter-pro` is a framework-agnostic rate limiting engine.

* Sliding window (accurate)
* Token bucket (burst support)
* Redis + memory fallback
* Works across all Node frameworks

---

## ⚙️ Configuration

```ts
{
  default: { window: 60, max: 100 },
  rules: [],
  key: (ctx) => ctx.ip,
  headers: true,
  skip: (ctx) => false,
  plugins: [],
  failOpen: true
}
```

---

### default

Base rate limit:

```ts
default: { window: 60, max: 100 }
```

---

### rules

Override limits per route:

```ts
rules: [
  { path: '/login', window: 60, max: 5 },
  { prefix: '/api', window: 60, max: 100 }
]
```

---

### key

Defines how requests are grouped:

```ts
key: (ctx) => ctx.ip
```

---

### headers

Enable response headers:

```ts
headers: true
```

---

### skip

Skip limiter conditionally:

```ts
skip: (ctx) => ctx.user?.isAdmin
```

---

### plugins

Extend functionality:

```ts
plugins: [whitelistPlugin(['127.0.0.1'])]
```

---

### failOpen

Allow requests if Redis fails:

```ts
failOpen: true
```

---

## 🔌 Adapters

---

### Express

```ts
app.use(expressAdapter(limiter, config))
```

---

### Fastify

```ts
fastify.addHook('onRequest', fastifyAdapter(limiter, config))
```

---

### Koa

```ts
app.use(koaAdapter(limiter, config))
```

---

### Hono

```ts
app.use('*', honoAdapter(limiter, config))
```

---

### Fetch / Edge

```ts
const middleware = fetchAdapter(limiter, config)

export default async (req) => {
  const blocked = await middleware(req)
  if (blocked) return blocked
}
```

---

## 🔌 Plugins

### Lifecycle

```ts
beforeRequest(ctx)
beforeLimit(ctx, key)
afterLimit(ctx, result)
onError(error, ctx)
```

---

### Example

```ts
{
  beforeRequest(ctx) {
    if (ctx.ip === 'admin') ctx.meta.skip = true
  }
}
```

---

## ⚡ Algorithms

---

### Sliding Window

* accurate
* no burst spikes

---

### Token Bucket

* supports bursts
* smooth refill

---

### Selection

```ts
algorithm: 'sliding-window' | 'token-bucket'
```
