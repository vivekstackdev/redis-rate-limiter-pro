# 🚀 Production Best Practices

Scaling a rate limiter for multi-million request APIs requires a robust strategy.

---

## 🚀 Key Normalization

Avoid the **"Path Explosion"** problem by using path normalization. The engine automatically converts numeric ID routes (`/user/123`, `/user/456`) into a shared route pattern (`/user/:id`).

- This results in a cleaner, shared Redis key space and prevents Redis memory bloat.
- The engine does this automatically by default using dynamic route resolution.

---

## 🧱 Resilience (Hybrid Mode)

In production, never let your rate-limiter take your API down.

- Use **HybridStore** as your primary data layer.
- Set `failStrategy: "fallback-to-memory"` (default) to ensure requests are allowed if Redis becomes unreachable.
- This ensures zero downtime and continues limiting locally even if the network fails.

---

## 🔥 Redis Usage Tips

- **Redis Timeout**: The built-in `RedisStore` uses `Promise.race()` to timeout slow Redis response times (default: 1000ms), ensuring high API latency remains low.
- **Retry Logic**: Single retry with exponential backoff + full jitter to prevent retry storms and thundering herd synchronization.
- **Circuit Breaker**: Detects transient Redis brownouts and bypasses the network for 2 seconds to allow recovery.
- **Security**: Use the `key` generator to rate limit by authenticated User ID rather than IP to prevent proxy-based abuse.

---

## 📊 Benchmarking & Testing

Validate your system performance before hitting production.

### Stress Test
Confirm the logic under heavy concurrency:
```bash
node tests/stress.ts
```

### Performance Benchmark
Measure how many requests per second your system can handle:
```bash
node scripts/benchmark.ts
```
