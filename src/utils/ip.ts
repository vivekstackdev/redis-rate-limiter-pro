import { isValidIP } from './validation.js';

const IP_HEADERS = [
  "x-forwarded-for",
  "x-real-ip",
  "cf-connecting-ip",
  "true-client-ip",
  "x-client-ip",
] as const;

// Extract IP address from headers
export function extractIPFromHeaders(headers?: Record<string, any>): string | undefined {
  if (!headers) return undefined;

  for (let i = 0; i < IP_HEADERS.length; i++) {
    const header = IP_HEADERS[i];
    const value = (headers as any)[header];
    if (!value) continue;

    // Use split(',')[0] for x-forwarded-for (first IP in the chain)
    const rawIp = header === "x-forwarded-for" ? value.split(",")[0] : value;
    const ipAddress = rawIp.trim();

    if (ipAddress && isValidIP(ipAddress)) {
      return ipAddress;
    }
  }

  return undefined;
}
