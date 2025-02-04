
/**
 * Retries an async operation a specified number of times, with exponential backoff between retries.
 *
 * @param fn - The async operation to retry.
 * @param maxRetries - The maximum number of retries. Defaults to 10.
 * @param baseDelay - The initial delay in milliseconds. Defaults to 10.
 * @returns The result of the successfully executed operation.
 * @throws The error that caused the last retry to fail.
 */
export async function retryAsyncOperation<T>(
  fn: () => Promise<T>,
  maxRetries = 10,
  baseDelay = 10
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((r) => setTimeout(r, baseDelay * 2 ** i));
    }
  }

  throw new Error("Unreachable");
}
