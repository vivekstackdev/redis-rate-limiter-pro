/**
 * Adapters Index
 * 
 * Re-exports all framework adapters for convenient import
 */

export { expressAdapter, rateLimiter, expressMiddleware } from './express.js';
export type { ExpressRateLimiterOptions } from './express.js';

export { fastifyAdapter } from './fastify.js';
export type { FastifyRateLimiterOptions } from './fastify.js';

export { fetchRateLimiter, honoRateLimiter } from './fetch.js';
export type { FetchRateLimiterOptions } from './fetch.js';

export { honoAdapter, honoHandler } from './hono.js';
export type { HonoAdapterConfig } from './hono.js';

export { koaAdapter } from './koa.js';
export type { KoaAdapterConfig } from './koa.js';

export * from './nest/index.js';
