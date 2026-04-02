import { isValidIP } from './validation.js';

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
