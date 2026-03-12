import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
} from "vitest";
import { MemFS } from "../../src/memfs";
import { Kernel } from "../../src/kernel";
import { initTranspiler, stopTranspiler } from "../../src/transpiler";
import { Container, boot } from "../../src/container";
import {
  IncomingMessage,
  ServerResponse,
  Server,
  createServer,
} from "../../src/polyfills/http";

beforeAll(async () => {
  await initTranspiler();
});

afterAll(async () => {
  await stopTranspiler();
});

// ---------------------------------------------------------------------------
// 1. HTTP Server Foundation
// ---------------------------------------------------------------------------

describe("Next.js: HTTP Server Foundation", () => {
  it("creates an HTTP server via the polyfill", () => {
    const server = createServer((req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    expect(server).toBeInstanceOf(Server);
    expect(server.listening).toBe(false);
  });

  it("IncomingMessage has expected properties", () => {
    const req = new IncomingMessage({
      method: "POST",
      url: "/api/data",
      headers: { "content-type": "application/json" },
    });
    expect(req.method).toBe("POST");
    expect(req.url).toBe("/api/data");
    expect(req.headers["content-type"]).toBe("application/json");
    expect(req.httpVersion).toBe("1.1");
    expect(req.socket.remoteAddress).toBe("127.0.0.1");
  });

  it("ServerResponse accumulates headers and body", () => {
    const res = new ServerResponse();
    res.writeHead(201, "Created", { "x-custom": "test" });
    res.end(JSON.stringify({ id: 1 }));

    expect(res.statusCode).toBe(201);
    expect(res.statusMessage).toBe("Created");
    expect(res.headersSent).toBe(true);
    expect(res.getHeader("x-custom")).toBe("test");
    expect(res.finished).toBe(true);

    const body = JSON.parse(res.getBodyString());
    expect(body).toEqual({ id: 1 });
  });

  it("Server.handleRequest dispatches to handler", async () => {
    const server = createServer((req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(`Hello from ${req.url}`);
    });

    const req = new IncomingMessage({ method: "GET", url: "/hello" });
    const res = new ServerResponse();
    await server.handleRequest(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.getBodyString()).toBe("Hello from /hello");
  });

  it("Server.listen sets port and listening flag", () => {
    const server = createServer();
    server.listen(3000);
    expect(server.listening).toBe(true);
    const addr = server.address();
    expect(addr).not.toBeNull();
    expect(addr!.port).toBe(3000);
    server.close();
    expect(server.listening).toBe(false);
  });

  it('creates an HTTP server via require("http") in the kernel', () => {
    const vfs = new MemFS();
    const runtime = new Kernel(vfs, { cwd: "/" });
    vfs.writeFileSync(
      "/server.js",
      `
      const http = require('http');
      const server = http.createServer((req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ message: 'ok' }));
      });
      module.exports = server;
    `,
    );
    const result = runtime.runFile("/server.js");
    const server = result.exports as Server;
    expect(server).toBeDefined();
    expect(typeof server.listen).toBe("function");
    expect(typeof server.handleRequest).toBe("function");
  });

  it("kernel HTTP server handles JSON request/response cycle", async () => {
    const vfs = new MemFS();
    const runtime = new Kernel(vfs, { cwd: "/" });
    vfs.writeFileSync(
      "/api-server.js",
      `
      const http = require('http');
      const server = http.createServer((req, res) => {
        if (req.url === '/api/status') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ status: 'healthy', method: req.method }));
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });
      module.exports = server;
    `,
    );
    const server = runtime.runFile("/api-server.js").exports as Server;

    const req = new IncomingMessage({ method: "GET", url: "/api/status" });
    const res = new ServerResponse();
    await server.handleRequest(req, res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.getBodyString())).toEqual({
      status: "healthy",
      method: "GET",
    });

    const req404 = new IncomingMessage({ method: "GET", url: "/unknown" });
    const res404 = new ServerResponse();
    await server.handleRequest(req404, res404);
    expect(res404.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// 2. App Router File Conventions
// ---------------------------------------------------------------------------

describe("Next.js: App Router File Conventions", () => {
  let vfs: MemFS;
  let runtime: Kernel;

  beforeEach(() => {
    vfs = new MemFS();
    runtime = new Kernel(vfs, { cwd: "/" });
  });

  it("stores and resolves app/layout.tsx and app/page.tsx", () => {
    vfs.mkdirSync("/app", { recursive: true });
    vfs.writeFileSync(
      "/app/layout.tsx",
      `
      export default function RootLayout({ children }: { children: any }) {
        return children;
      }
    `,
    );
    vfs.writeFileSync(
      "/app/page.tsx",
      `
      export default function Home() {
        return { type: 'h1', text: 'Welcome' };
      }
    `,
    );

    expect(vfs.existsSync("/app/layout.tsx")).toBe(true);
    expect(vfs.existsSync("/app/page.tsx")).toBe(true);

    const layout = runtime.runFile("/app/layout.tsx");
    expect(typeof (layout.exports as any).default).toBe("function");

    const page = runtime.runFile("/app/page.tsx");
    const Home = (page.exports as any).default;
    expect(typeof Home).toBe("function");
    expect(Home()).toEqual({ type: "h1", text: "Welcome" });
  });

  it("handles nested routes: app/about/page.tsx", () => {
    vfs.mkdirSync("/app/about", { recursive: true });
    vfs.writeFileSync(
      "/app/about/page.tsx",
      `
      export default function About() {
        return { type: 'h1', text: 'About Us' };
      }
    `,
    );
    const result = runtime.runFile("/app/about/page.tsx");
    const About = (result.exports as any).default;
    expect(About()).toEqual({ type: "h1", text: "About Us" });
  });

  it("handles dynamic routes with bracket notation: app/posts/[slug]/page.tsx", () => {
    vfs.mkdirSync("/app/posts/[slug]", { recursive: true });
    vfs.writeFileSync(
      "/app/posts/[slug]/page.tsx",
      `
      export default function PostPage({ params }: { params: { slug: string } }) {
        return { type: 'article', slug: params.slug };
      }
    `,
    );

    expect(vfs.existsSync("/app/posts/[slug]/page.tsx")).toBe(true);
    const entries = vfs.readdirSync("/app/posts");
    expect(entries).toContain("[slug]");

    const result = runtime.runFile("/app/posts/[slug]/page.tsx");
    const PostPage = (result.exports as any).default;
    expect(PostPage({ params: { slug: "hello-world" } })).toEqual({
      type: "article",
      slug: "hello-world",
    });
  });

  it("handles route groups with parenthesized directories", () => {
    vfs.mkdirSync("/app/(marketing)/pricing", { recursive: true });
    vfs.mkdirSync("/app/(auth)/login", { recursive: true });

    vfs.writeFileSync(
      "/app/(marketing)/pricing/page.tsx",
      `
      export default function Pricing() { return { page: 'pricing' }; }
    `,
    );
    vfs.writeFileSync(
      "/app/(auth)/login/page.tsx",
      `
      export default function Login() { return { page: 'login' }; }
    `,
    );

    expect(vfs.readdirSync("/app")).toContain("(marketing)");
    expect(vfs.readdirSync("/app")).toContain("(auth)");

    const pricing = runtime.runFile("/app/(marketing)/pricing/page.tsx");
    expect((pricing.exports as any).default()).toEqual({ page: "pricing" });

    const login = runtime.runFile("/app/(auth)/login/page.tsx");
    expect((login.exports as any).default()).toEqual({ page: "login" });
  });

  it("stores special files: loading.tsx, error.tsx, not-found.tsx", () => {
    vfs.mkdirSync("/app/dashboard", { recursive: true });

    vfs.writeFileSync(
      "/app/dashboard/loading.tsx",
      `
      export default function Loading() { return { type: 'loading' }; }
    `,
    );
    vfs.writeFileSync(
      "/app/dashboard/error.tsx",
      `
      'use client';
      export default function ErrorBoundary({ error }: { error: Error }) {
        return { type: 'error', message: error.message };
      }
    `,
    );
    vfs.writeFileSync(
      "/app/not-found.tsx",
      `
      export default function NotFound() { return { type: '404' }; }
    `,
    );

    const loading = runtime.runFile("/app/dashboard/loading.tsx");
    expect((loading.exports as any).default()).toEqual({ type: "loading" });

    const error = runtime.runFile("/app/dashboard/error.tsx");
    const ErrorBoundary = (error.exports as any).default;
    expect(ErrorBoundary({ error: new Error("oops") })).toEqual({
      type: "error",
      message: "oops",
    });

    const notFound = runtime.runFile("/app/not-found.tsx");
    expect((notFound.exports as any).default()).toEqual({ type: "404" });
  });
});

// ---------------------------------------------------------------------------
// 3. App Router API Routes (route.ts)
// ---------------------------------------------------------------------------

describe("Next.js: App Router API Routes", () => {
  let vfs: MemFS;
  let runtime: Kernel;

  beforeEach(() => {
    vfs = new MemFS();
    runtime = new Kernel(vfs, { cwd: "/" });
  });

  it("exports GET and POST handlers from route.ts", () => {
    vfs.mkdirSync("/app/api/hello", { recursive: true });
    vfs.writeFileSync(
      "/app/api/hello/route.ts",
      `
      export async function GET(request: Request): Promise<Response> {
        return new Response(JSON.stringify({ message: 'Hello!', method: 'GET' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      export async function POST(request: Request): Promise<Response> {
        return new Response(JSON.stringify({ message: 'Created', method: 'POST' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    `,
    );

    const result = runtime.runFile("/app/api/hello/route.ts");
    const exports = result.exports as any;
    expect(typeof exports.GET).toBe("function");
    expect(typeof exports.POST).toBe("function");
  });

  it("GET handler returns valid Response", async () => {
    vfs.mkdirSync("/app/api/status", { recursive: true });
    vfs.writeFileSync(
      "/app/api/status/route.ts",
      `
      export async function GET() {
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    `,
    );

    const GET = (runtime.runFile("/app/api/status/route.ts").exports as any)
      .GET;
    const response = await GET();
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("exports all HTTP method handlers", () => {
    vfs.mkdirSync("/app/api/resource", { recursive: true });
    vfs.writeFileSync(
      "/app/api/resource/route.ts",
      `
      export async function GET() { return new Response('get'); }
      export async function POST() { return new Response('post'); }
      export async function PUT() { return new Response('put'); }
      export async function DELETE() { return new Response('delete'); }
      export async function PATCH() { return new Response('patch'); }
    `,
    );

    const exports = runtime.runFile("/app/api/resource/route.ts")
      .exports as any;
    expect(typeof exports.GET).toBe("function");
    expect(typeof exports.POST).toBe("function");
    expect(typeof exports.PUT).toBe("function");
    expect(typeof exports.DELETE).toBe("function");
    expect(typeof exports.PATCH).toBe("function");
  });

  it("route handler with query parameter parsing", async () => {
    vfs.mkdirSync("/app/api/search", { recursive: true });
    vfs.writeFileSync(
      "/app/api/search/route.ts",
      `
      export async function GET(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const q = url.searchParams.get('q') || '';
        return new Response(JSON.stringify({ query: q, results: [] }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    `,
    );

    const GET = (runtime.runFile("/app/api/search/route.ts").exports as any)
      .GET;
    const response = await GET(
      new Request("http://localhost:3000/api/search?q=nextjs"),
    );
    const body = await response.json();
    expect(body.query).toBe("nextjs");
    expect(body.results).toEqual([]);
  });

  it("TypeScript API route with interfaces", async () => {
    vfs.mkdirSync("/app/api/users", { recursive: true });
    vfs.writeFileSync(
      "/app/api/users/route.ts",
      `
      interface User {
        id: number;
        name: string;
        email: string;
      }

      const users: User[] = [
        { id: 1, name: 'Alice', email: 'alice@example.com' },
        { id: 2, name: 'Bob', email: 'bob@example.com' },
      ];

      export async function GET(): Promise<Response> {
        return new Response(JSON.stringify(users), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    `,
    );

    const GET = (runtime.runFile("/app/api/users/route.ts").exports as any).GET;
    const response = await GET();
    const data = await response.json();
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe("Alice");
    expect(data[1].email).toBe("bob@example.com");
  });
});

// ---------------------------------------------------------------------------
// 4. Pages Router API Routes
// ---------------------------------------------------------------------------

describe("Next.js: Pages Router API Routes", () => {
  let vfs: MemFS;
  let runtime: Kernel;

  beforeEach(() => {
    vfs = new MemFS();
    runtime = new Kernel(vfs, { cwd: "/" });
  });

  it("exports default handler from pages/api/hello.ts", () => {
    vfs.mkdirSync("/pages/api", { recursive: true });
    vfs.writeFileSync(
      "/pages/api/hello.ts",
      `
      export default function handler(req: any, res: any) {
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ message: 'Hello from Pages API' }));
      }
    `,
    );

    const handler = (runtime.runFile("/pages/api/hello.ts").exports as any)
      .default;
    expect(typeof handler).toBe("function");
  });

  it("Pages API handler works with HTTP polyfill req/res", () => {
    vfs.mkdirSync("/pages/api", { recursive: true });
    vfs.writeFileSync(
      "/pages/api/greet.ts",
      `
      export default function handler(req: any, res: any) {
        const name = req.url?.split('?name=')[1] || 'World';
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ greeting: 'Hello ' + name }));
      }
    `,
    );

    const handler = (runtime.runFile("/pages/api/greet.ts").exports as any)
      .default;
    const req = new IncomingMessage({
      method: "GET",
      url: "/api/greet?name=Next",
    });
    const res = new ServerResponse();
    handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.getHeader("content-type")).toBe("application/json");
    const body = JSON.parse(res.getBodyString());
    expect(body.greeting).toBe("Hello Next");
  });

  it("Pages API handler handles POST with status helper pattern", () => {
    vfs.mkdirSync("/pages/api", { recursive: true });
    vfs.writeFileSync(
      "/pages/api/submit.ts",
      `
      export default function handler(req: any, res: any) {
        if (req.method !== 'POST') {
          res.writeHead(405);
          res.end('Method Not Allowed');
          return;
        }
        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      }
    `,
    );

    const handler = (runtime.runFile("/pages/api/submit.ts").exports as any)
      .default;

    const postReq = new IncomingMessage({ method: "POST", url: "/api/submit" });
    const postRes = new ServerResponse();
    handler(postReq, postRes);
    expect(postRes.statusCode).toBe(201);
    expect(JSON.parse(postRes.getBodyString())).toEqual({ success: true });

    const getReq = new IncomingMessage({ method: "GET", url: "/api/submit" });
    const getRes = new ServerResponse();
    handler(getReq, getRes);
    expect(getRes.statusCode).toBe(405);
  });
});

// ---------------------------------------------------------------------------
// 5. 'use client' Directive
// ---------------------------------------------------------------------------

describe("Next.js: 'use client' Directive", () => {
  let vfs: MemFS;
  let runtime: Kernel;

  beforeEach(() => {
    vfs = new MemFS();
    runtime = new Kernel(vfs, { cwd: "/" });
  });

  it('preserves "use client" directive in source and exports component', () => {
    vfs.writeFileSync(
      "/app/counter.tsx",
      `
      'use client';

      export default function Counter({ initial }: { initial: number }) {
        return { type: 'counter', value: initial };
      }
    `,
    );

    const source = vfs.readFileSync("/app/counter.tsx", "utf8");
    expect(source).toContain("'use client'");

    const result = runtime.runFile("/app/counter.tsx");
    const Counter = (result.exports as any).default;
    expect(typeof Counter).toBe("function");
    expect(Counter({ initial: 5 })).toEqual({ type: "counter", value: 5 });
  });

  it("client component with multiple named exports", () => {
    vfs.writeFileSync(
      "/components/button.tsx",
      `
      'use client';

      export function Button({ label }: { label: string }) {
        return { type: 'button', label };
      }

      export function IconButton({ icon }: { icon: string }) {
        return { type: 'icon-button', icon };
      }
    `,
    );

    const exports = runtime.runFile("/components/button.tsx").exports as any;
    expect(typeof exports.Button).toBe("function");
    expect(typeof exports.IconButton).toBe("function");
    expect(exports.Button({ label: "Click" })).toEqual({
      type: "button",
      label: "Click",
    });
    expect(exports.IconButton({ icon: "star" })).toEqual({
      type: "icon-button",
      icon: "star",
    });
  });

  it("server component can require a client component module", () => {
    vfs.mkdirSync("/components", { recursive: true });
    vfs.writeFileSync(
      "/components/client-widget.tsx",
      `
      'use client';
      export default function Widget() {
        return { type: 'widget', interactive: true };
      }
    `,
    );

    vfs.writeFileSync(
      "/app/page.tsx",
      `
      import WidgetMod from '../components/client-widget';

      export default function Page() {
        // ESM-to-CJS interop: default import may be the module or the function
        const Widget = typeof WidgetMod === 'function' ? WidgetMod : WidgetMod.default;
        const w = Widget();
        return { type: 'page', widget: w };
      }
    `,
    );

    const result = runtime.runFile("/app/page.tsx");
    const Page = (result.exports as any).default;
    expect(Page()).toEqual({
      type: "page",
      widget: { type: "widget", interactive: true },
    });
  });

  it("client component with hooks-like pattern", () => {
    vfs.writeFileSync(
      "/hooks/use-count.ts",
      `
      'use client';
      export function useCount(initial: number) {
        let value = initial;
        return {
          get: () => value,
          increment: () => { value++; return value; },
        };
      }
    `,
    );

    const { useCount } = runtime.runFile("/hooks/use-count.ts").exports as any;
    const counter = useCount(10);
    expect(counter.get()).toBe(10);
    expect(counter.increment()).toBe(11);
  });
});

// ---------------------------------------------------------------------------
// 6. 'use server' Directive
// ---------------------------------------------------------------------------

describe("Next.js: 'use server' Directive", () => {
  let vfs: MemFS;
  let runtime: Kernel;

  beforeEach(() => {
    vfs = new MemFS();
    runtime = new Kernel(vfs, { cwd: "/" });
  });

  it('preserves "use server" directive and exports async functions', () => {
    vfs.writeFileSync(
      "/actions/db.ts",
      `
      'use server';

      export async function createUser(name: string) {
        return { id: 1, name };
      }

      export async function deleteUser(id: number) {
        return { deleted: id };
      }
    `,
    );

    const source = vfs.readFileSync("/actions/db.ts", "utf8");
    expect(source).toContain("'use server'");

    const exports = runtime.runFile("/actions/db.ts").exports as any;
    expect(typeof exports.createUser).toBe("function");
    expect(typeof exports.deleteUser).toBe("function");
  });

  it("server action functions are callable and return correct values", async () => {
    vfs.writeFileSync(
      "/actions/items.ts",
      `
      'use server';

      interface Item { id: number; title: string; }

      const items: Item[] = [];

      export async function addItem(title: string): Promise<Item> {
        const item = { id: items.length + 1, title };
        items.push(item);
        return item;
      }

      export async function getItems(): Promise<Item[]> {
        return [...items];
      }
    `,
    );

    const exports = runtime.runFile("/actions/items.ts").exports as any;
    const item = await exports.addItem("Test Item");
    expect(item).toEqual({ id: 1, title: "Test Item" });

    await exports.addItem("Second Item");
    const all = await exports.getItems();
    expect(all).toHaveLength(2);
    expect(all[1].title).toBe("Second Item");
  });

  it('inline "use server" inside a function body is preserved', () => {
    vfs.writeFileSync(
      "/app/form-page.tsx",
      `
      export default function FormPage() {
        async function submitAction(data: any) {
          'use server';
          return { submitted: true, data };
        }
        return { type: 'form', action: submitAction };
      }
    `,
    );

    const source = vfs.readFileSync("/app/form-page.tsx", "utf8");
    expect(source).toContain("'use server'");

    const FormPage = (runtime.runFile("/app/form-page.tsx").exports as any)
      .default;
    const rendered = FormPage();
    expect(rendered.type).toBe("form");
    expect(typeof rendered.action).toBe("function");
  });

  it("server action is callable from inline definition", async () => {
    vfs.writeFileSync(
      "/app/inline-action.tsx",
      `
      export default function Page() {
        async function save(name: string) {
          'use server';
          return { saved: name };
        }
        return { action: save };
      }
    `,
    );

    const Page = (runtime.runFile("/app/inline-action.tsx").exports as any)
      .default;
    const { action } = Page();
    const result = await action("document.txt");
    expect(result).toEqual({ saved: "document.txt" });
  });
});

// ---------------------------------------------------------------------------
// 7. TypeScript in Next.js Patterns
// ---------------------------------------------------------------------------

describe("Next.js: TypeScript Patterns", () => {
  let vfs: MemFS;
  let runtime: Kernel;

  beforeEach(() => {
    vfs = new MemFS();
    runtime = new Kernel(vfs, { cwd: "/" });
  });

  it("page.tsx with typed params prop", () => {
    vfs.mkdirSync("/app/blog/[slug]", { recursive: true });
    vfs.writeFileSync(
      "/app/blog/[slug]/page.tsx",
      `
      interface PageProps {
        params: { slug: string };
        searchParams: Record<string, string | string[] | undefined>;
      }

      export default function BlogPost({ params, searchParams }: PageProps) {
        return {
          slug: params.slug,
          query: searchParams,
        };
      }
    `,
    );

    const BlogPost = (
      runtime.runFile("/app/blog/[slug]/page.tsx").exports as any
    ).default;
    const result = BlogPost({
      params: { slug: "my-post" },
      searchParams: { tag: "ts" },
    });
    expect(result.slug).toBe("my-post");
    expect(result.query).toEqual({ tag: "ts" });
  });

  it("layout.tsx with React.ReactNode children typing", () => {
    vfs.mkdirSync("/app", { recursive: true });
    vfs.writeFileSync(
      "/app/layout.tsx",
      `
      type ReactNode = string | number | boolean | null | undefined | object;

      interface LayoutProps {
        children: ReactNode;
      }

      export const metadata = {
        title: 'My App',
        description: 'Built with Next.js',
      };

      export default function RootLayout({ children }: LayoutProps) {
        return { tag: 'html', children };
      }
    `,
    );

    const exports = runtime.runFile("/app/layout.tsx").exports as any;
    expect(exports.metadata).toEqual({
      title: "My App",
      description: "Built with Next.js",
    });
    const Layout = exports.default;
    expect(Layout({ children: "hello" })).toEqual({
      tag: "html",
      children: "hello",
    });
  });

  it("API route with typed request/response helpers", async () => {
    vfs.mkdirSync("/app/api/typed", { recursive: true });
    vfs.writeFileSync(
      "/app/api/typed/route.ts",
      `
      type NextRequest = Request;

      interface ApiResponse<T> {
        data: T;
        timestamp: number;
      }

      function jsonResponse<T>(data: T, status = 200): Response {
        const body: ApiResponse<T> = { data, timestamp: Date.now() };
        return new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      export async function GET(req: NextRequest): Promise<Response> {
        return jsonResponse({ items: ['a', 'b', 'c'] });
      }

      export async function POST(req: NextRequest): Promise<Response> {
        return jsonResponse({ created: true }, 201);
      }
    `,
    );

    const exports = runtime.runFile("/app/api/typed/route.ts").exports as any;
    const getResp = await exports.GET(
      new Request("http://localhost/api/typed"),
    );
    expect(getResp.status).toBe(200);
    const getData = await getResp.json();
    expect(getData.data.items).toEqual(["a", "b", "c"]);
    expect(typeof getData.timestamp).toBe("number");

    const postResp = await exports.POST(
      new Request("http://localhost/api/typed", { method: "POST" }),
    );
    expect(postResp.status).toBe(201);
  });

  it("generics and utility types in page components", () => {
    vfs.writeFileSync(
      "/app/generic-page.tsx",
      `
      type Prettify<T> = { [K in keyof T]: T[K] } & {};

      interface BaseProps {
        id: string;
        title: string;
      }

      interface ExtendedProps extends BaseProps {
        tags: string[];
      }

      function createPage<T extends BaseProps>(props: Prettify<T>): { rendered: true; props: T } {
        return { rendered: true, props };
      }

      export default function Page() {
        const data: ExtendedProps = { id: '1', title: 'Test', tags: ['next', 'ts'] };
        return createPage(data);
      }
    `,
    );

    const Page = (runtime.runFile("/app/generic-page.tsx").exports as any)
      .default;
    const result = Page();
    expect(result.rendered).toBe(true);
    expect(result.props.tags).toEqual(["next", "ts"]);
  });

  it("catch-all and optional catch-all route types", () => {
    vfs.mkdirSync("/app/docs/[...segments]", { recursive: true });
    vfs.writeFileSync(
      "/app/docs/[...segments]/page.tsx",
      `
      interface DocsProps {
        params: { segments: string[] };
      }

      export default function DocsPage({ params }: DocsProps) {
        return {
          breadcrumb: params.segments.join(' > '),
          depth: params.segments.length,
        };
      }
    `,
    );

    const DocsPage = (
      runtime.runFile("/app/docs/[...segments]/page.tsx").exports as any
    ).default;
    const result = DocsPage({
      params: { segments: ["guides", "setup", "intro"] },
    });
    expect(result.breadcrumb).toBe("guides > setup > intro");
    expect(result.depth).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 8. Module Resolution for Next.js Packages
// ---------------------------------------------------------------------------

describe("Next.js: Module Resolution", () => {
  let vfs: MemFS;
  let runtime: Kernel;

  beforeEach(() => {
    vfs = new MemFS();
    runtime = new Kernel(vfs, { cwd: "/" });
    setupMockNextPackage(vfs);
  });

  it("resolves next/navigation with useRouter stub", () => {
    vfs.writeFileSync(
      "/app/nav-test.ts",
      `
      const { useRouter, usePathname, useSearchParams } = require('next/navigation');
      module.exports = {
        hasRouter: typeof useRouter === 'function',
        hasPathname: typeof usePathname === 'function',
        hasSearchParams: typeof useSearchParams === 'function',
      };
    `,
    );

    const result = runtime.runFile("/app/nav-test.ts").exports as any;
    expect(result.hasRouter).toBe(true);
    expect(result.hasPathname).toBe(true);
    expect(result.hasSearchParams).toBe(true);
  });

  it("resolves next/link and next/image stubs", () => {
    vfs.writeFileSync(
      "/app/link-test.ts",
      `
      const Link = require('next/link');
      const Image = require('next/image');
      module.exports = {
        hasLink: typeof (Link.default || Link) === 'function',
        hasImage: typeof (Image.default || Image) === 'function',
      };
    `,
    );

    const result = runtime.runFile("/app/link-test.ts").exports as any;
    expect(result.hasLink).toBe(true);
    expect(result.hasImage).toBe(true);
  });

  it("resolves next/headers stub", () => {
    vfs.writeFileSync(
      "/app/headers-test.ts",
      `
      const { cookies, headers } = require('next/headers');
      module.exports = {
        hasCookies: typeof cookies === 'function',
        hasHeaders: typeof headers === 'function',
      };
    `,
    );

    const result = runtime.runFile("/app/headers-test.ts").exports as any;
    expect(result.hasCookies).toBe(true);
    expect(result.hasHeaders).toBe(true);
  });

  it("resolves next/navigation via ESM import in TSX", () => {
    vfs.writeFileSync(
      "/app/esm-nav.tsx",
      `
      import { useRouter, usePathname } from 'next/navigation';

      export default function NavComponent() {
        const router = useRouter();
        const pathname = usePathname();
        return { router: typeof router, pathname };
      }
    `,
    );

    const NavComponent = (runtime.runFile("/app/esm-nav.tsx").exports as any)
      .default;
    const result = NavComponent();
    expect(result.router).toBe("object");
    expect(result.pathname).toBe("/");
  });
});

function setupMockNextPackage(vfs: MemFS) {
  const nextBase = "/node_modules/next";
  vfs.mkdirSync(nextBase, { recursive: true });
  vfs.mkdirSync(`${nextBase}/navigation`, { recursive: true });
  vfs.mkdirSync(`${nextBase}/link`, { recursive: true });
  vfs.mkdirSync(`${nextBase}/image`, { recursive: true });
  vfs.mkdirSync(`${nextBase}/headers`, { recursive: true });

  vfs.writeFileSync(
    `${nextBase}/package.json`,
    JSON.stringify({
      name: "next",
      version: "14.0.0",
      exports: {
        "./navigation": "./navigation/index.js",
        "./link": "./link/index.js",
        "./image": "./image/index.js",
        "./headers": "./headers/index.js",
      },
    }),
  );

  vfs.writeFileSync(
    `${nextBase}/navigation/index.js`,
    `
    module.exports.useRouter = function useRouter() {
      return { push: function(){}, replace: function(){}, back: function(){}, forward: function(){} };
    };
    module.exports.usePathname = function usePathname() { return '/'; };
    module.exports.useSearchParams = function useSearchParams() {
      return { get: function(k) { return null; }, getAll: function(k) { return []; } };
    };
    module.exports.useParams = function useParams() { return {}; };
    module.exports.redirect = function redirect(url) { throw new Error('NEXT_REDIRECT:' + url); };
    module.exports.notFound = function notFound() { throw new Error('NEXT_NOT_FOUND'); };
  `,
  );

  vfs.writeFileSync(
    `${nextBase}/link/index.js`,
    `
    function Link(props) { return { type: 'a', href: props.href, children: props.children }; }
    module.exports = Link;
    module.exports.default = Link;
  `,
  );

  vfs.writeFileSync(
    `${nextBase}/image/index.js`,
    `
    function Image(props) { return { type: 'img', src: props.src, alt: props.alt }; }
    module.exports = Image;
    module.exports.default = Image;
  `,
  );

  vfs.writeFileSync(
    `${nextBase}/headers/index.js`,
    `
    module.exports.cookies = function cookies() {
      return { get: function(n) { return undefined; }, set: function(){}, delete: function(){} };
    };
    module.exports.headers = function headers() {
      return { get: function(n) { return null; }, has: function(n) { return false; } };
    };
  `,
  );
}

// ---------------------------------------------------------------------------
// 9. CSS Modules (File Handling)
// ---------------------------------------------------------------------------

describe("Next.js: CSS Modules", () => {
  let vfs: MemFS;
  let runtime: Kernel;

  beforeEach(() => {
    vfs = new MemFS();
    runtime = new Kernel(vfs, { cwd: "/" });
  });

  it("stores and reads .module.css files", () => {
    vfs.mkdirSync("/app/components", { recursive: true });
    vfs.writeFileSync(
      "/app/components/card.module.css",
      `
      .card { background: white; border-radius: 8px; padding: 16px; }
      .title { font-size: 1.5rem; font-weight: bold; }
      .active { border: 2px solid blue; }
    `,
    );

    expect(vfs.existsSync("/app/components/card.module.css")).toBe(true);
    const content = vfs.readFileSync("/app/components/card.module.css", "utf8");
    expect(content).toContain(".card");
    expect(content).toContain(".title");
    expect(content).toContain(".active");
  });

  it("component can import CSS module via mock loader", () => {
    vfs.mkdirSync("/app/components", { recursive: true });
    vfs.writeFileSync(
      "/app/components/card.module.css",
      `.card { color: red; }`,
    );

    // Simulate a CSS module loader that returns scoped class names
    vfs.mkdirSync("/node_modules/css-module-loader", { recursive: true });
    vfs.writeFileSync(
      "/node_modules/css-module-loader/package.json",
      JSON.stringify({
        name: "css-module-loader",
        main: "index.js",
      }),
    );
    vfs.writeFileSync(
      "/node_modules/css-module-loader/index.js",
      `
      module.exports.loadCssModule = function(cssContent) {
        const classes = {};
        const matches = cssContent.matchAll(/\\.([\\w-]+)\\s*\\{/g);
        for (const m of matches) {
          classes[m[1]] = m[1] + '_' + Math.random().toString(36).slice(2, 6);
        }
        return classes;
      };
    `,
    );

    vfs.writeFileSync(
      "/app/components/card.tsx",
      `
      const fs = require('fs');
      const { loadCssModule } = require('css-module-loader');
      const css = fs.readFileSync('/app/components/card.module.css', 'utf8');
      const styles = loadCssModule(css);

      export default function Card() {
        return { className: styles.card, hasClass: typeof styles.card === 'string' };
      }
    `,
    );

    const Card = (runtime.runFile("/app/components/card.tsx").exports as any)
      .default;
    const result = Card();
    expect(result.hasClass).toBe(true);
    expect(result.className).toContain("card");
  });

  it("multiple CSS module files coexist without collisions", () => {
    vfs.mkdirSync("/app/a", { recursive: true });
    vfs.mkdirSync("/app/b", { recursive: true });
    vfs.writeFileSync("/app/a/styles.module.css", `.title { color: red; }`);
    vfs.writeFileSync("/app/b/styles.module.css", `.title { color: blue; }`);

    expect(vfs.existsSync("/app/a/styles.module.css")).toBe(true);
    expect(vfs.existsSync("/app/b/styles.module.css")).toBe(true);
    const a = vfs.readFileSync("/app/a/styles.module.css", "utf8");
    const b = vfs.readFileSync("/app/b/styles.module.css", "utf8");
    expect(a).toContain("red");
    expect(b).toContain("blue");
  });
});

// ---------------------------------------------------------------------------
// 10. Server + Request Routing Integration
// ---------------------------------------------------------------------------

describe("Next.js: Server + Routing Integration", () => {
  let container: Container;

  beforeEach(() => {
    container = boot();
    setupMockNextPackage(container.vfs);
  });

  it("routes /api/* requests to App Router route handlers", async () => {
    container.writeFile(
      "/app/api/hello/route.ts",
      `
      export async function GET() {
        return new Response(JSON.stringify({ message: 'hello' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    `,
    );

    // Simulate routing: resolve file from URL path, execute, call handler
    const routeFile = "/app/api/hello/route.ts";
    expect(container.exists(routeFile)).toBe(true);

    const routeModule = container.execute(
      `module.exports = require('${routeFile}');`,
    );
    const GET = (routeModule.exports as any).GET;
    const response = await GET();
    const body = await response.json();
    expect(body.message).toBe("hello");
  });

  it("routes page requests to App Router page components", () => {
    container.writeFile(
      "/app/layout.tsx",
      `
      export default function Layout({ children }: any) { return children; }
    `,
    );
    container.writeFile(
      "/app/page.tsx",
      `
      export default function Home() { return { page: 'home' }; }
    `,
    );
    container.writeFile(
      "/app/about/page.tsx",
      `
      export default function About() { return { page: 'about' }; }
    `,
    );

    // Resolve "/" -> /app/page.tsx
    const homeMod = container.runFile("/app/page.tsx");
    expect((homeMod.exports as any).default()).toEqual({ page: "home" });

    // Resolve "/about" -> /app/about/page.tsx
    const aboutMod = container.runFile("/app/about/page.tsx");
    expect((aboutMod.exports as any).default()).toEqual({ page: "about" });
  });

  it("end-to-end: HTTP server dispatches to route handlers", async () => {
    container.writeFile(
      "/app/api/users/route.ts",
      `
      export async function GET() {
        return new Response(JSON.stringify([{ id: 1, name: 'Alice' }]), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      export async function POST() {
        return new Response(JSON.stringify({ id: 2, created: true }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    `,
    );

    // Build a simple router that maps URL to route file and method to handler
    container.writeFile(
      "/router.ts",
      `
      const fs = require('fs');
      const path = require('path');

      interface RouteMatch {
        handler: Function;
        params: Record<string, string>;
      }

      export function matchApiRoute(method: string, url: string): RouteMatch | null {
        const urlPath = new URL(url, 'http://localhost').pathname;
        if (!urlPath.startsWith('/api/')) return null;

        const routeFile = '/app' + urlPath + '/route.ts';
        if (!fs.existsSync(routeFile)) return null;

        const routeModule = require(routeFile);
        const handler = routeModule[method];
        if (typeof handler !== 'function') return null;

        return { handler, params: {} };
      }
    `,
    );

    const { matchApiRoute } = container.runFile("/router.ts").exports as any;

    const getMatch = matchApiRoute("GET", "http://localhost:3000/api/users");
    expect(getMatch).not.toBeNull();
    const getResp = await getMatch.handler();
    expect(await getResp.json()).toEqual([{ id: 1, name: "Alice" }]);

    const postMatch = matchApiRoute("POST", "http://localhost:3000/api/users");
    expect(postMatch).not.toBeNull();
    const postResp = await postMatch.handler();
    expect(postResp.status).toBe(201);
    expect(await postResp.json()).toEqual({ id: 2, created: true });

    const noMatch = matchApiRoute(
      "GET",
      "http://localhost:3000/api/nonexistent",
    );
    expect(noMatch).toBeNull();
  });

  it("dynamic route matching with parameter extraction", () => {
    container.writeFile(
      "/app/posts/[id]/page.tsx",
      `
      export default function Post({ params }: { params: { id: string } }) {
        return { post: params.id };
      }
    `,
    );

    // Simulate dynamic route matching
    container.writeFile(
      "/matcher.ts",
      `
      const fs = require('fs');

      interface MatchResult {
        filePath: string;
        params: Record<string, string>;
      }

      export function matchRoute(urlPath: string): MatchResult | null {
        const directPath = '/app' + urlPath + '/page.tsx';
        if (fs.existsSync(directPath)) return { filePath: directPath, params: {} };

        // Check dynamic segments
        const segments = urlPath.split('/').filter(Boolean);
        let currentDir = '/app';
        const params: Record<string, string> = {};

        for (const segment of segments) {
          const entries = fs.readdirSync(currentDir);
          if (entries.includes(segment)) {
            currentDir += '/' + segment;
          } else {
            const dynamic = entries.find((e: string) => e.startsWith('[') && e.endsWith(']'));
            if (dynamic) {
              const paramName = dynamic.slice(1, -1);
              params[paramName] = segment;
              currentDir += '/' + dynamic;
            } else {
              return null;
            }
          }
        }

        const pagePath = currentDir + '/page.tsx';
        if (fs.existsSync(pagePath)) return { filePath: pagePath, params };
        return null;
      }
    `,
    );

    const { matchRoute } = container.runFile("/matcher.ts").exports as any;

    const match = matchRoute("/posts/42");
    expect(match).not.toBeNull();
    expect(match.params).toEqual({ id: "42" });

    const Post = (container.runFile(match.filePath).exports as any).default;
    expect(Post({ params: match.params })).toEqual({ post: "42" });
  });

  it("full request lifecycle: HTTP server -> router -> handler -> response", async () => {
    container.writeFile(
      "/app/api/echo/route.ts",
      `
      export async function POST(request: Request): Promise<Response> {
        const body = await request.text();
        return new Response(JSON.stringify({ echo: body }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    `,
    );

    // Create an HTTP server that routes to App Router handlers
    container.writeFile(
      "/server.ts",
      `
      const http = require('http');
      const fs = require('fs');

      const server = http.createServer((req: any, res: any) => {
        const routeFile = '/app' + req.url + '/route.ts';
        if (!fs.existsSync(routeFile)) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }
        const mod = require(routeFile);
        const handler = mod[req.method];
        if (!handler) {
          res.writeHead(405);
          res.end('Method Not Allowed');
          return;
        }

        const request = new Request('http://localhost' + req.url, { method: req.method });
        handler(request).then(async (response: any) => {
          res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
          res.end(await response.text());
        });
      });
      module.exports = server;
    `,
    );

    const server = container.runFile("/server.ts").exports as any;

    // Test successful route
    const req = new IncomingMessage({ method: "POST", url: "/api/echo" });
    const res = new ServerResponse();
    await server.handleRequest(req, res);

    // The handler creates a Request without body in this simplified flow,
    // so echo will be empty string
    await new Promise(r => setTimeout(r, 10));
    expect(res.statusCode).toBe(200);

    // Test 404
    const req404 = new IncomingMessage({ method: "GET", url: "/api/missing" });
    const res404 = new ServerResponse();
    await server.handleRequest(req404, res404);
    expect(res404.statusCode).toBe(404);
  });

  afterEach(() => {
    container.destroy();
  });
});
