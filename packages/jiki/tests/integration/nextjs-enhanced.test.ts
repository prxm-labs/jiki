import { describe, it, expect, beforeEach } from "vitest";
import { MemFS } from "../../src/memfs";
import { NextDevServer } from "../../src/frameworks/next-dev-server";
import { ServerBridge, resetServerBridge } from "../../src/server-bridge";
import { BufferImpl as Buffer } from "../../src/polyfills/stream";

function setupProject(vfs: MemFS, useAppRouter = true) {
  vfs.mkdirSync("/pages", { recursive: true });
  vfs.mkdirSync("/pages/api", { recursive: true });
  vfs.mkdirSync("/app", { recursive: true });
  vfs.mkdirSync("/app/api/hello", { recursive: true });
  vfs.mkdirSync("/public", { recursive: true });

  vfs.writeFileSync(
    "/package.json",
    JSON.stringify({
      name: "test-app",
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0",
        next: "^14.0.0",
      },
    }),
  );

  vfs.writeFileSync(
    "/tsconfig.json",
    JSON.stringify({
      compilerOptions: { target: "es5", paths: { "@/*": ["./*"] } },
    }),
  );

  if (useAppRouter) {
    vfs.writeFileSync(
      "/app/layout.tsx",
      `export default function RootLayout({ children }) {
  return <div>{children}</div>;
}`,
    );
    vfs.writeFileSync(
      "/app/page.tsx",
      `export default function Home() {
  return <h1>Hello App Router</h1>;
}`,
    );
    vfs.writeFileSync(
      "/app/api/hello/route.ts",
      `export async function GET() {
  return Response.json({ message: 'Hello from App Router API' });
}`,
    );
  } else {
    vfs.writeFileSync(
      "/pages/index.tsx",
      `export default function Home() {
  return <h1>Hello Pages Router</h1>;
}`,
    );
    vfs.writeFileSync(
      "/pages/api/hello.ts",
      `export default function handler(req, res) {
  res.status(200).json({ message: 'Hello from Pages Router API' });
}`,
    );
  }
}

describe("Enhanced NextDevServer", () => {
  let vfs: MemFS;

  beforeEach(() => {
    vfs = new MemFS();
    resetServerBridge();
  });

  describe("NPM module endpoint", () => {
    it("serves module from node_modules as JS", async () => {
      setupProject(vfs);
      vfs.mkdirSync("/node_modules/my-pkg", { recursive: true });
      vfs.writeFileSync(
        "/node_modules/my-pkg/index.js",
        "export const foo = 42;",
      );

      const server = new NextDevServer(vfs, {
        port: 3000,
        preferAppRouter: true,
      });
      const response = await server.handleRequest(
        "GET",
        "/_npm/my-pkg/index.js",
        {},
      );
      expect(response.statusCode).toBe(200);
      expect(response.headers["Content-Type"]).toContain("javascript");
    });

    it("returns 404 for missing module", async () => {
      setupProject(vfs);
      const server = new NextDevServer(vfs, {
        port: 3000,
        preferAppRouter: true,
      });
      const response = await server.handleRequest(
        "GET",
        "/_npm/nonexistent/index.js",
        {},
      );
      expect(response.statusCode).toBe(404);
    });

    it("serves JSON files as ES modules", async () => {
      setupProject(vfs);
      vfs.mkdirSync("/node_modules/my-pkg", { recursive: true });
      vfs.writeFileSync("/node_modules/my-pkg/data.json", '{"key":"value"}');

      const server = new NextDevServer(vfs, {
        port: 3000,
        preferAppRouter: true,
      });
      const response = await server.handleRequest(
        "GET",
        "/_npm/my-pkg/data.json",
        {},
      );
      expect(response.statusCode).toBe(200);
      const body = new TextDecoder().decode(response.body);
      expect(body).toContain("export default");
    });
  });

  describe("installed packages detection", () => {
    it("passes installed packages to redirectNpmImports", async () => {
      setupProject(vfs);
      vfs.mkdirSync("/node_modules/lucide-react", { recursive: true });
      vfs.writeFileSync(
        "/node_modules/lucide-react/package.json",
        '{"name":"lucide-react","main":"index.js"}',
      );
      vfs.writeFileSync(
        "/node_modules/lucide-react/index.js",
        "export const Camera = () => {};",
      );

      const server = new NextDevServer(vfs, {
        port: 3000,
        preferAppRouter: true,
      });

      const tsxFile = "/test-component.tsx";
      vfs.writeFileSync(
        tsxFile,
        `import { Camera } from 'lucide-react';
export default function Test() { return <Camera />; }`,
      );

      const response = await server.handleRequest("GET", tsxFile, {});
      expect(response.statusCode).toBe(200);
    });

    it("invalidates package cache", () => {
      setupProject(vfs);
      const server = new NextDevServer(vfs, {
        port: 3000,
        preferAppRouter: true,
      });
      server.invalidatePackageCache();
      // Should not throw
    });
  });

  describe("Tailwind CSS config loading", () => {
    it("loads tailwind.config.ts and injects config script", async () => {
      setupProject(vfs);
      vfs.writeFileSync(
        "/tailwind.config.ts",
        `import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#7c3aed",
      },
    },
  },
} satisfies Config;`,
      );

      const server = new NextDevServer(vfs, {
        port: 3000,
        preferAppRouter: true,
      });
      const response = await server.handleRequest("GET", "/", {});
      expect(response.statusCode).toBe(200);
      const body = new TextDecoder().decode(response.body);
      expect(body).toContain("tailwind.config");
    });

    it("handles missing tailwind config gracefully", async () => {
      setupProject(vfs);
      const server = new NextDevServer(vfs, {
        port: 3000,
        preferAppRouter: true,
      });
      const response = await server.handleRequest("GET", "/", {});
      expect(response.statusCode).toBe(200);
    });
  });

  describe("Pages Router and App Router routing", () => {
    it("handles App Router page route", async () => {
      setupProject(vfs, true);
      const server = new NextDevServer(vfs, {
        port: 3000,
        preferAppRouter: true,
      });
      const response = await server.handleRequest("GET", "/", {});
      expect(response.statusCode).toBe(200);
      const body = new TextDecoder().decode(response.body);
      expect(body).toContain("<!DOCTYPE html");
      expect(body).toContain("__next");
      expect(body).toContain("/app/page.tsx");
    });

    it("handles Pages Router page route", async () => {
      setupProject(vfs, false);
      const server = new NextDevServer(vfs, {
        port: 3000,
        preferAppRouter: false,
      });
      const response = await server.handleRequest("GET", "/", {});
      expect(response.statusCode).toBe(200);
    });

    it("handles App Router API route", async () => {
      setupProject(vfs, true);
      const server = new NextDevServer(vfs, {
        port: 3000,
        preferAppRouter: true,
      });
      const response = await server.handleRequest("GET", "/api/hello", {});
      expect(response.statusCode).toBe(200);
    });
  });

  describe("TypeScript/TSX handling", () => {
    it("transforms TSX files", async () => {
      setupProject(vfs);
      vfs.writeFileSync(
        "/app/typescript/page.tsx",
        `interface Props { name: string; }
function Greeting({ name }: Props) { return <p>Hello {name}</p>; }
export default function TypeScriptPage() { return <Greeting name="World" />; }`,
      );

      const server = new NextDevServer(vfs, {
        port: 3000,
        preferAppRouter: true,
      });
      const response = await server.handleRequest("GET", "/typescript", {});
      expect(response.statusCode).toBe(200);
    });
  });

  describe("HMR events", () => {
    it("emits HMR update on file change", () => {
      setupProject(vfs);
      const server = new NextDevServer(vfs, {
        port: 3000,
        preferAppRouter: true,
      });
      server.start();

      const updates: unknown[] = [];
      server.on("hmr-update", (u: unknown) => updates.push(u));

      vfs.writeFileSync(
        "/app/page.tsx",
        "export default function Home() { return <h1>Updated</h1>; }",
      );

      expect(updates.length).toBeGreaterThanOrEqual(1);
      server.stop();
    });
  });

  describe("ServerBridge integration", () => {
    it("routes requests through bridge to dev server", async () => {
      setupProject(vfs);
      const server = new NextDevServer(vfs, {
        port: 3000,
        preferAppRouter: true,
      });
      server.start();

      const bridge = new ServerBridge({ baseUrl: "http://localhost" });
      bridge.registerServer(server, 3000);

      const response = await bridge.handleRequest(3000, "GET", "/", {});
      expect(response.statusCode).toBe(200);

      bridge.unregisterServer(3000);
      server.stop();
    });

    it("bridge fetch handler works with dev server", async () => {
      setupProject(vfs);
      const server = new NextDevServer(vfs, {
        port: 3000,
        preferAppRouter: true,
      });
      server.start();

      const bridge = new ServerBridge({ baseUrl: "http://localhost" });
      bridge.registerServer(server, 3000);
      const handler = bridge.createFetchHandler();

      const fetchResponse = await handler(
        new Request("http://localhost/__virtual__/3000/"),
      );
      expect(fetchResponse.status).toBe(200);

      bridge.unregisterServer(3000);
      server.stop();
    });
  });

  describe("public file serving", () => {
    it("serves public files", async () => {
      setupProject(vfs);
      vfs.writeFileSync("/public/robots.txt", "User-agent: *\nAllow: /");

      const server = new NextDevServer(vfs, {
        port: 3000,
        preferAppRouter: true,
      });
      const response = await server.handleRequest("GET", "/robots.txt", {});
      expect(response.statusCode).toBe(200);
      expect(new TextDecoder().decode(response.body)).toContain("User-agent");
    });
  });
});
