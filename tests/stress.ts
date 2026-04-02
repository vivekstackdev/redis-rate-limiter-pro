import Redis from 'ioredis';
import { createRateLimiter } from '../dist/esm/index.js';
import { RedisStore } from '../dist/esm/store/redisStore.js';
import { MemoryStore } from '../dist/esm/store/memoryStore.js';
import { HybridStore } from '../dist/esm/store/hybridStore.js';

async function runTests() {
  console.log("🔥 Starting redis-rate-limiter-pro Validation Suite (authenticated Redis)...");

  const redisUrl = "redis://:mypassword@127.0.0.1:6379";
  const redisProcess = new Redis(redisUrl); // use the authenticated URL

  try {
    await redisProcess.ping();
    console.log("✅ Authenticated Redis connected.");
  } catch (e) {
    console.error("❌ Redis Connection Failed:", e);
    process.exit(1);
  }

  // 1. Setup Data Stores
  const redisStore = new RedisStore(redisProcess, { timeoutMs: 100 });
  const memoryStore = new MemoryStore();
  const hybridStore = new HybridStore({ redis: redisStore, memory: memoryStore });

  // Metric tracking
  let fallbackCount = 0;
  const originalConsume = memoryStore.consume.bind(memoryStore);
  memoryStore.consume = (...args) => {
    fallbackCount++;
    return originalConsume(...args);
  };

  // 2. Setup Limiter Engine
  const limiter = createRateLimiter({
    store: hybridStore,
    default: { window: 10, max: 2000 },
    failStrategy: 'fallback-to-memory',
    policies: [
      { path: '/api/burst', max: 50, window: 5, algorithm: 'token-bucket', burst: 100 },
      { path: '/api/route/:id', max: 20, window: 10, algorithm: 'sliding-window' }
    ]
  });

  const generateContext = (path: string, ip: string = '127.0.0.1') => ({
    ip,
    method: 'GET',
    path,
    headers: {},
    raw: {}
  });

  // 3. Concurrency Test
  console.log("\n🚀 Test 1: Concurrency (10,000 requests in batch)");
  const start = Date.now();
  const results = await Promise.all(
    Array.from({ length: 10000 }).map(() => limiter.check(generateContext('/api/heavy-load')))
  );
  const end = Date.now();
  console.log(`✅ Processed 10,000 requests in ${end - start}ms`);

  const blocks = results.filter(r => r.blocked).length;
  console.log(`✅ Blocked requests: ${blocks} (Expected approx: 8000)`);

  // 4. Route Policies Test
  console.log("\n🛣️  Test 2: Dynamic Route Policies limits mapping");
  const result1 = await limiter.check(generateContext('/api/route/123'));
  // Should match generic `/api/route/:id` meaning limited to 20
  const headerLimit = result1.headers && (result1.headers as any)['X-RateLimit-Limit'];
  console.log(`✅ Result1 headers map limit: ${headerLimit}`);

  // 5. Redis Failure Mode
  console.log("\n🔥 Test 3: Redis Failure (Trigger Hybrid mode)");
  // Reset counter to measure ONLY failure mode
  fallbackCount = 0;
  
  // Fake Redis fail
  (redisProcess as any).disconnect();
  console.log("Disconnected Redis...");
  
  const startFail = Date.now();
  const failResults = await Promise.all(
    Array.from({ length: 100 }).map(() => limiter.check(generateContext('/api/heavy-load-after-fail')))
  );
  const endFail = Date.now();
  
  console.log(`✅ Processed 100 fallback requests in ${endFail - startFail}ms`);
  console.log(`✅ Fallback count: ${fallbackCount}`);
  
  if (fallbackCount >= 100) {
    console.log("✅ Circuit Breaker & Fallback Verified.");
  } else {
    console.error(`❌ Fallback count too low (${fallbackCount}). Expected at least 100.`);
  }

  process.exit(0);

  process.exit(0);
}

runTests().catch(e => {
  console.error("Fatal Test Error:", e);
  process.exit(1);
});
