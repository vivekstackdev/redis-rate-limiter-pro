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
