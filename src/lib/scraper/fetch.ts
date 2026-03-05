const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;

/** Fetch a URL with timeout and simple retry logic. Returns the response body as text. */
export async function fetchPage(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'DerTown-EventScraper/1.0',
          Accept: 'text/html, application/json, text/calendar, */*',
        },
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      return await res.text();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        // Back off briefly before retry
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  throw new Error(`Failed to fetch ${url} after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
}
