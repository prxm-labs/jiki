/**
 * Network request interception and mocking for jiki containers.
 *
 * Allows intercepting and mocking outgoing `fetch()` calls from executed
 * code. Useful for testing, offline scenarios, and CORS avoidance.
 *
 * @example
 * ```ts
 * const container = boot();
 * container.mockFetch('/api/users', { json: [{ name: 'Alice' }] });
 * container.execute('fetch("/api/users").then(r => r.json()).then(console.log)');
 * ```
 */

export interface MockResponse {
  /** HTTP status code. Default: 200. */
  status?: number;
  /** Response headers. */
  headers?: Record<string, string>;
  /** Response body as string. */
  body?: string;
  /** Response body as JSON (auto-serialized). Overrides `body`. */
  json?: unknown;
}

export type FetchHandler = (
  url: string,
  init?: RequestInit,
) => MockResponse | null | undefined | Promise<MockResponse | null | undefined>;

interface MockRule {
  pattern: string | RegExp;
  response?: MockResponse;
  handler?: FetchHandler;
}

/**
 * Intercepts fetch calls and returns mock responses when a URL matches
 * a registered pattern.
 */
export class NetworkInterceptor {
  private rules: MockRule[] = [];
  private handlers: FetchHandler[] = [];

  /**
   * Register a static mock response for a URL pattern.
   *
   * @param pattern - String (exact match or prefix) or RegExp
   * @param response - Mock response to return
   */
  mock(pattern: string | RegExp, response: MockResponse): void {
    this.rules.push({ pattern, response });
  }

  /**
   * Register a dynamic handler that can inspect the request and return
   * a response. Return `null` to pass through to the next handler or
   * the real network.
   */
  onFetch(handler: FetchHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Remove all mock rules and handlers.
   */
  clear(): void {
    this.rules.length = 0;
    this.handlers.length = 0;
  }

  /** Number of registered rules. */
  get ruleCount(): number {
    return this.rules.length;
  }

  /** Number of registered handlers. */
  get handlerCount(): number {
    return this.handlers.length;
  }

  /**
   * Try to match a URL against registered rules and handlers.
   * Returns a Response-like object if matched, or `null` to pass through.
   */
  async intercept(
    url: string,
    init?: RequestInit,
  ): Promise<MockResponse | null> {
    // Check static rules first
    for (const rule of this.rules) {
      if (this.matches(url, rule.pattern)) {
        return rule.response || { status: 200 };
      }
    }

    // Check dynamic handlers
    for (const handler of this.handlers) {
      const result = await handler(url, init);
      if (result) return result;
    }

    return null;
  }

  private matches(url: string, pattern: string | RegExp): boolean {
    if (pattern instanceof RegExp) return pattern.test(url);
    // String: exact match or prefix match
    return url === pattern || url.startsWith(pattern);
  }
}

/**
 * Convert a MockResponse to a format suitable for the `fetch` polyfill.
 */
export function mockResponseToFetchResponse(mock: MockResponse): {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
  arrayBuffer: () => Promise<ArrayBuffer>;
} {
  const status = mock.status ?? 200;
  const body =
    mock.json !== undefined ? JSON.stringify(mock.json) : (mock.body ?? "");
  const headers = {
    "Content-Type": mock.json !== undefined ? "application/json" : "text/plain",
    ...mock.headers,
  };

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : String(status),
    headers,
    text: async () => body,
    json: async () => (mock.json !== undefined ? mock.json : JSON.parse(body)),
    arrayBuffer: async () =>
      new TextEncoder().encode(body).buffer as ArrayBuffer,
  };
}
