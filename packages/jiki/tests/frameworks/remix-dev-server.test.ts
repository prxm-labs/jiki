import { describe, it, expect, beforeEach } from "vitest";
import { MemFS } from "../../src/memfs";
import { RemixDevServer } from "../../src/frameworks/remix-dev-server";

describe("RemixDevServer", () => {
  let vfs: MemFS;
  let server: RemixDevServer;

  beforeEach(() => {
    vfs = new MemFS();
    vfs.mkdirSync("/app/routes", { recursive: true });
    vfs.writeFileSync(
      "/app/routes/_index.tsx",
      "export default function Index() { return <h1>Home</h1>; }",
    );
    vfs.writeFileSync(
      "/app/routes/about.tsx",
      "export default function About() { return <h1>About</h1>; }",
    );
    vfs.writeFileSync(
      "/app/routes/dashboard.settings.tsx",
      "export default function Settings() { return <h1>Settings</h1>; }",
    );
    vfs.writeFileSync(
      "/app/root.tsx",
      "export default function Root({ children }) { return <html><body>{children}</body></html>; }",
    );

    server = new RemixDevServer(vfs, { port: 3000, root: "/" });
  });

  it("serves root route (_index)", async () => {
    const res = await server.handleRequest("GET", "http://localhost:3000/", {});
    expect(res.statusCode).toBe(200);
    const body = res.body.toString();
    expect(body).toContain("Remix App");
    expect(body).toContain("_index.tsx");
  });

  it("serves named route", async () => {
    const res = await server.handleRequest(
      "GET",
      "http://localhost:3000/about",
      {},
    );
    expect(res.statusCode).toBe(200);
    const body = res.body.toString();
    expect(body).toContain("about.tsx");
  });

  it("serves dot-delimited nested route", async () => {
    const res = await server.handleRequest(
      "GET",
      "http://localhost:3000/dashboard/settings",
      {},
    );
    expect(res.statusCode).toBe(200);
    const body = res.body.toString();
    expect(body).toContain("dashboard.settings.tsx");
  });

  it("includes root.tsx when present", async () => {
    const res = await server.handleRequest("GET", "http://localhost:3000/", {});
    const body = res.body.toString();
    expect(body).toContain("root.tsx");
  });

  it("discovers routes", () => {
    const routes = server.discoverRoutes();
    expect(routes.length).toBe(3);
    expect(routes.some(r => r.route === "/")).toBe(true);
    expect(routes.some(r => r.route === "/about")).toBe(true);
    expect(routes.some(r => r.route === "/dashboard/settings")).toBe(true);
  });

  it("falls through to ViteDevServer for static files", async () => {
    vfs.writeFileSync("/favicon.ico", new Uint8Array([0]));
    const res = await server.handleRequest(
      "GET",
      "http://localhost:3000/favicon.ico",
      {},
    );
    expect(res.statusCode).toBe(200);
  });
});
