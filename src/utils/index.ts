// Utility functions
import type { RateLimitContext } from '../types/index.js';

// Extract IP address from headers
export function extractIPFromHeaders(headers?: Record<string, any>): string | undefined {
  if (!headers) return undefined;
  
  const ipHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip',
    'true-client-ip',
    'x-client-ip'
  ];
  
  for (const header of ipHeaders) {
    const value = headers[header];
    if (value) {
      const ip = header === 'x-forwarded-for' 
        ? value.split(',')[0].trim()
        : value.trim();
      
      if (ip && isValidIP(ip)) {
        return ip;
      }
    }
  }
  
  return undefined;
}

// Get IP from RateLimitContext
export function getClientIP(ctx: RateLimitContext): string {
  // Direct IP (from framework's req.ip)
  if (ctx.ip) {
    return ctx.ip;
  }
  
  // Extract from headers
  const headerIP = extractIPFromHeaders(ctx.headers);
  if (headerIP) {
    return headerIP;
  }
  
  return 'anonymous';
}

// Basic IP validation (IPv4 and IPv6)
export function isValidIP(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  
  // Quick check: IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length > 8) return false;
    return parts.every(part => {
      if (part === '') return true;
      const n = parseInt(part, 16);
      return !isNaN(n) && n >= 0 && n <= 0xFFFF;
    });
  }
  
  // IPv4 validation with fast uint32 arithmetic
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  
  let num = 0;
  for (let i = 0; i < 4; i++) {
    const part = parts[i]!;
    const n = +part;
    
    if (n > 255 || n < 0 || part.length > 3 || isNaN(n)) return false;
    num = (num << 8) | n;
  }
  
  return true;
}

// Default key generator - uses client IP
export const defaultKeyGenerator = (ctx: RateLimitContext): string => {
  return getClientIP(ctx);
};

// Validation utilities

export function validateExists<T>(value: T | null | undefined, fieldName: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Validation failed: ${fieldName} is required`);
  }
  return value;
}

export function validateStringArray(arr: any[], fieldName: string): string[] {
  if (!Array.isArray(arr)) {
    throw new Error(`Validation failed: ${fieldName} must be an array`);
  }
  
  const invalidItems = arr.filter(item => !item || typeof item !== 'string');
  if (invalidItems.length > 0) {
    throw new Error(`Validation failed: ${fieldName} contains invalid items`);
  }
  
  return arr as string[];
}

// Execute with error propagation
export async function executeWithErrors<T>(
  fn: () => T | Promise<T>,
  context?: string
): Promise<T> {
  try {
    return await Promise.resolve(fn());
  } catch (error) {
    if (context && error instanceof Error) {
      error.message = `[${context}] ${error.message}`;
    }
    throw error;
  }
}

// Execute with explicit error handler
export async function executeWithHandler<T>(
  fn: () => T | Promise<T>,
  onError: (error: unknown) => void
): Promise<T | undefined> {
  try {
    return await Promise.resolve(fn());
  } catch (error) {
    onError(error);
    return undefined;
  }
}
