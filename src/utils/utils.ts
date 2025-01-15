/**
 * Retries an async operation until it succeeds or the maximum number of retries is reached.
 *
 * Retries are performed with an exponential backoff strategy, with a random 10% jitter
 * added to the delay between retries. The delay for the `n`th retry is given by
 * `baseDelay * 2^n * (1 + 0.1 * random())`.
 *
 * @param fn - The async operation to retry.
 * @param maxRetries - The maximum number of times to retry the operation. Defaults to 10.
 * @param baseDelay - The base delay in milliseconds between retries. Defaults to 50.
 * @throws Error - If the maximum number of retries is exceeded.
 */
export async function retryAsyncOperation(
  fn: () => Promise<void>,
  maxRetries = 10,
  baseDelay = 50
): Promise<void> {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      const delay =
        baseDelay * Math.pow(2, attempt) * (1 + Math.random() * 0.1);
      await new Promise((resolve) => setImmediate(resolve, delay));
      attempt++;
    }
  }
  throw new Error("Max retries exceeded");
}
