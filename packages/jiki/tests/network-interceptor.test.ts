import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  NetworkInterceptor,
  mockResponseToFetchResponse,
} from "../src/network-interceptor";
import { boot } from "../src/container";

describe("NetworkInterceptor", () => {
  let interceptor: NetworkInterceptor;

  beforeEach(() => {
    interceptor = new NetworkInterceptor();
  });

  describe("mock", () => {
    it("matches exact string URL", async () => {
      interceptor.mock("/api/users", { json: [{ name: "Alice" }] });
      const result = await interceptor.intercept("/api/users");
      expect(result).not.toBeNull();
      expect(result!.json).toEqual([{ name: "Alice" }]);
    });

    it("matches URL prefix", async () => {
      interceptor.mock("/api/", { status: 200, body: "ok" });
      const result = await interceptor.intercept("/api/anything");
      expect(result).not.toBeNull();
      expect(result!.body).toBe("ok");
    });

    it("matches RegExp", async () => {
      interceptor.mock(/\/api\/users\/\d+/, { json: { id: 1 } });
      expect(await interceptor.intercept("/api/users/42")).not.toBeNull();
      expect(await interceptor.intercept("/api/users/abc")).toBeNull();
    });

    it("returns null for non-matching URL", async () => {
      interceptor.mock("/api/users", { json: [] });
      expect(await interceptor.intercept("/other")).toBeNull();
    });

    it("first matching rule wins", async () => {
      interceptor.mock("/api", { body: "first" });
      interceptor.mock("/api/users", { body: "second" });
      const result = await interceptor.intercept("/api/users");
      expect(result!.body).toBe("first");
    });
  });

  describe("onFetch", () => {
    it("calls handler and returns its result", async () => {
      interceptor.onFetch(url => {
        if (url.includes("special")) return { json: { special: true } };
        return null;
      });
      expect(await interceptor.intercept("/special")).not.toBeNull();
      expect(await interceptor.intercept("/normal")).toBeNull();
    });

    it("async handler works", async () => {
      interceptor.onFetch(async () => {
        return { status: 201, body: "created" };
      });
      const result = await interceptor.intercept("/anything");
      expect(result!.status).toBe(201);
    });

    it("rules are checked before handlers", async () => {
      interceptor.mock("/api", { body: "from-rule" });
      interceptor.onFetch(() => ({ body: "from-handler" }));
      const result = await interceptor.intercept("/api");
      expect(result!.body).toBe("from-rule");
    });
  });

  describe("clear", () => {
    it("removes all rules and handlers", async () => {
      interceptor.mock("/api", { body: "ok" });
      interceptor.onFetch(() => ({ body: "handler" }));
      interceptor.clear();
      expect(interceptor.ruleCount).toBe(0);
      expect(interceptor.handlerCount).toBe(0);
      expect(await interceptor.intercept("/api")).toBeNull();
    });
  });
});

describe("mockResponseToFetchResponse", () => {
  it("converts JSON mock to fetch-like response", async () => {
    const resp = mockResponseToFetchResponse({ json: { ok: true } });
    expect(resp.ok).toBe(true);
    expect(resp.status).toBe(200);
    expect(resp.headers["Content-Type"]).toBe("application/json");
    expect(await resp.json()).toEqual({ ok: true });
  });

  it("converts body string to fetch-like response", async () => {
    const resp = mockResponseToFetchResponse({ body: "hello" });
    expect(await resp.text()).toBe("hello");
    expect(resp.headers["Content-Type"]).toBe("text/plain");
  });

  it("handles non-200 status", () => {
    const resp = mockResponseToFetchResponse({ status: 404 });
    expect(resp.ok).toBe(false);
    expect(resp.status).toBe(404);
  });
});

describe("Container network mocking", () => {
  it("container has network interceptor", () => {
    const c = boot();
    expect(c.network).toBeDefined();
    expect(c.network.ruleCount).toBe(0);
  });

  it("mockFetch registers a rule", () => {
    const c = boot();
    c.mockFetch("/api/test", { json: { ok: true } });
    expect(c.network.ruleCount).toBe(1);
  });

  it("onFetch registers a handler", () => {
    const c = boot();
    c.onFetch(() => null);
    expect(c.network.handlerCount).toBe(1);
  });
});
