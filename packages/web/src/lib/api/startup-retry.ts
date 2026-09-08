type StartupRetryOptions = {
  attempts?: number;
  delayMs?: number;
};

const DEFAULT_ATTEMPTS = 40;
const DEFAULT_DELAY_MS = 100;

/**
 * Retry an API read briefly while the single-process local app is starting.
 *
 * `repowise serve` launches both the API and the standalone Next.js UI. On a
 * cold start the browser can reach Next.js a fraction of a second before
 * uvicorn has finished binding its socket. Without this guard, Server
 * Components permanently render the "Can't reach the API" fallback from that
 * one transient failure and require a manual reload.
 *
 * This deliberately has a short, bounded window. A genuinely unavailable API
 * still fails normally after a few seconds instead of being hidden forever.
 */
export async function withApiStartupRetry<T>(
  operation: () => Promise<T>,
  options: StartupRetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? DEFAULT_ATTEMPTS);
  const delayMs = Math.max(0, options.delayMs ?? DEFAULT_DELAY_MS);

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
