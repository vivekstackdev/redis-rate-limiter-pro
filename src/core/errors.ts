// Error types
export type RateLimiterErrorCode = 'STORE_ERROR' | 'PLUGIN_ERROR' | 'CONFIG_ERROR';

export class RateLimiterError extends Error {
  public code: RateLimiterErrorCode;
  
  constructor(message: string, code: RateLimiterErrorCode) {
    super(message);
    this.code = code;
    this.name = 'RateLimiterError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RateLimiterError);
    }
  }
}

export class StoreError extends RateLimiterError {
  constructor(message: string) {
    super(message, 'STORE_ERROR');
    this.name = 'StoreError';
  }
}

export class PluginError extends RateLimiterError {
  constructor(message: string) {
    super(message, 'PLUGIN_ERROR');
    this.name = 'PluginError';
  }
}

export class ConfigError extends RateLimiterError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigError';
  }
}
