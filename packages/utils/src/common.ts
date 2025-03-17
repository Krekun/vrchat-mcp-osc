/**
 * Common utility functions
 */

/**
 * Generate a random ID string
 * 
 * @param length Length of the ID (default: 8)
 * @returns Random ID string
 */
export function generateId(length: number = 8): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Deep clone an object
 * 
 * @param obj Object to clone
 * @returns Cloned object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }
  
  const result = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = deepClone(obj[key]);
    }
  }
  
  return result;
}

/**
 * Check if the application is running in development mode
 * 
 * @returns True if in development mode, false otherwise
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Delay execution for a specified time
 * 
 * @param ms Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a promise that rejects after a timeout
 * 
 * @param ms Timeout in milliseconds
 * @param message Error message
 * @returns Promise that rejects after the timeout
 */
export function createTimeout(ms: number, message: string = 'Operation timed out'): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * Execute a promise with a timeout
 * 
 * @param promise Promise to execute
 * @param ms Timeout in milliseconds
 * @param message Error message
 * @returns Promise with timeout
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string = 'Operation timed out'): Promise<T> {
  return Promise.race([
    promise,
    createTimeout(ms, message)
  ]);
}