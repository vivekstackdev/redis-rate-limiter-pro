import type { RateLimitResult, AlgorithmType } from '../types/index.js';

export interface Store {
  consume(
    key: string,
    window: number,
    max: number,
    algorithm?: AlgorithmType,
    burst?: number
  ): Promise<RateLimitResult> | RateLimitResult;
  
  peek?(
    key: string,
    window: number,
    max: number,
    algorithm?: AlgorithmType
  ): Promise<RateLimitResult> | RateLimitResult;
  
  reset(key?: string): Promise<void> | void;
  
  getStats?(): Record<string, any>;
  
  destroy?(): void | Promise<void>;
}
