import { createRateLimiter } from "../dist/esm/index.js";
import { Redis } from "ioredis";

async function runBenchmark() {
  console.log("🚀 Starting Rate Limiter Benchmark (authenticated Redis)...\n");

  const redisUrl = "redis://:mypassword@127.0.0.1:6379";
  const redis = new Redis(redisUrl);

  try {
    await redis.ping();
    console.log("✅ Authenticated Redis connected.\n");
  } catch (e) {
    console.error("❌ Redis Connection Failed:", e);
    process.exit(1);
  }

  const limiters = [
    { name: "MemoryStore", config: { store: "memory" as const, default: { window: 60, max: 1000000 } } },
    { name: "RedisStore", config: { store: "redis" as const, redis, default: { window: 60, max: 1000000 } } }
  ];

  const REQUESTS = 10000;
  const CONCURRENCY = 100;

  for (const { name, config } of limiters) {
    const limiter = createRateLimiter(config as any);
    console.log(`Testing ${name} with ${REQUESTS} requests (${CONCURRENCY} concurrency)...`);

    const start = Date.now();

    for (let i = 0; i < REQUESTS; i += CONCURRENCY) {
      const batch = Array.from({ length: CONCURRENCY }).map(() =>
        limiter.check({
          ip: "127.0.0.1",
          method: "GET",
          path: "/test",
          headers: {},
          raw: {}
        })
      );
      await Promise.all(batch);
    }

    const duration = Date.now() - start;
    const rps = Math.floor((REQUESTS / duration) * 1000);

    console.log(`✅ ${name}: ${duration}ms (${rps} req/s)\n`);
  }

  await redis.quit();
  process.exit(0);
}

runBenchmark().catch(console.error);
