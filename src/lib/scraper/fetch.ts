const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;

/** Fetch a URL with timeout and simple retry logic. Returns the response body as text. */
export async function fetchPage(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      // Add cache-busting query parameter
      const separator = url.includes('?') ? '&' : '?';
      const bustUrl = `${url}${separator}_t=${Date.now()}`;

      const res = await fetch(bustUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          Accept: 'text/html, application/json, text/calendar, */*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
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
