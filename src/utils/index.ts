export * from './ip.js';
export * from './keyGenerator.js';
export * from './validation.js';
export * from './headers.js';
export * from './time.js';

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
