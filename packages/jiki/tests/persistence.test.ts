import { describe, it, expect, beforeEach } from "vitest";
import { MemFS } from "../src/memfs";
import { InMemoryAdapter } from "../src/persistence";
import { Container, boot } from "../src/container";

// ---------------------------------------------------------------------------
// InMemoryAdapter unit tests
// ---------------------------------------------------------------------------
describe("InMemoryAdapter", () => {
  let adapter: InMemoryAdapter;

  beforeEach(() => {
    adapter = new InMemoryAdapter();
  });

  it("starts empty", async () => {
    const entries = await adapter.loadAll();
    expect(entries).toEqual([]);
    expect(adapter.size).toBe(0);
  });

  it("save + loadAll round-trip", async () => {
    adapter.save({
      path: "/a.txt",
      type: "file",
      content: new Uint8Array([65]),
      mtime: 1000,
    });
    adapter.save({ path: "/dir", type: "directory", mtime: 2000 });
    adapter.save({
      path: "/link",
      type: "symlink",
      target: "/a.txt",
      mtime: 3000,
    });

    const entries = await adapter.loadAll();
    expect(entries).toHaveLength(3);
    expect(entries.find(e => e.path === "/a.txt")?.type).toBe("file");
    expect(entries.find(e => e.path === "/dir")?.type).toBe("directory");
    expect(entries.find(e => e.path === "/link")?.target).toBe("/a.txt");
  });

  it("save overwrites existing entry", async () => {
    adapter.save({
      path: "/a.txt",
      type: "file",
      content: new Uint8Array([65]),
      mtime: 1000,
    });
    adapter.save({
      path: "/a.txt",
      type: "file",
      content: new Uint8Array([66]),
      mtime: 2000,
    });

    const entries = await adapter.loadAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].content).toEqual(new Uint8Array([66]));
  });

  it("delete removes an entry", async () => {
    adapter.save({
      path: "/a.txt",
      type: "file",
      content: new Uint8Array([65]),
      mtime: 1000,
    });
    adapter.delete("/a.txt");

    const entries = await adapter.loadAll();
    expect(entries).toHaveLength(0);
  });

  it("clear removes all entries", async () => {
    adapter.save({ path: "/a.txt", type: "file", mtime: 1000 });
    adapter.save({ path: "/b.txt", type: "file", mtime: 1000 });
    await adapter.clear();
    expect(adapter.size).toBe(0);
  });

  it("flush is a no-op", async () => {
    await expect(adapter.flush()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// MemFS + persistence integration tests
// ---------------------------------------------------------------------------
describe("MemFS with persistence", () => {
  let adapter: InMemoryAdapter;
  let vfs: MemFS;

  beforeEach(() => {
    adapter = new InMemoryAdapter();
    vfs = new MemFS({ persistence: adapter });
  });

  it("writeFileSync persists file entries", () => {
    vfs.writeFileSync("/hello.txt", "world");
    expect(adapter.size).toBe(1);
  });

  it("persisted entry has correct type and content", async () => {
    vfs.writeFileSync("/test.txt", "data");
    const entries = await adapter.loadAll();
    expect(entries[0].path).toBe("/test.txt");
    expect(entries[0].type).toBe("file");
    expect(entries[0].content).toBeInstanceOf(Uint8Array);
  });

  it("writeFileSync updates existing persisted entry", async () => {
    vfs.writeFileSync("/f.txt", "v1");
    vfs.writeFileSync("/f.txt", "v2");
    const entries = await adapter.loadAll();
    expect(entries).toHaveLength(1);
    const text = new TextDecoder().decode(entries[0].content);
    expect(text).toBe("v2");
  });

  it("symlinkSync persists symlink entries", async () => {
    vfs.writeFileSync("/target.txt", "data");
    vfs.symlinkSync("/target.txt", "/link");
    const entries = await adapter.loadAll();
    const symlink = entries.find(e => e.path === "/link");
    expect(symlink).toBeDefined();
    expect(symlink!.type).toBe("symlink");
    expect(symlink!.target).toBe("/target.txt");
  });

  it("unlinkSync removes persisted entry", async () => {
    vfs.writeFileSync("/temp.txt", "data");
    expect(adapter.size).toBe(1);
    vfs.unlinkSync("/temp.txt");
    expect(adapter.size).toBe(0);
  });

  it("rmdirSync recursive removes tree from persistence", async () => {
    vfs.mkdirSync("/dir", { recursive: true });
    vfs.writeFileSync("/dir/a.txt", "a");
    vfs.writeFileSync("/dir/b.txt", "b");
    const sizeBefore = adapter.size;
    expect(sizeBefore).toBe(2); // only files are persisted via writeFileSync

    vfs.rmdirSync("/dir", { recursive: true });
    expect(adapter.size).toBe(0);
  });

  it("renameSync moves persisted entry", async () => {
    vfs.writeFileSync("/old.txt", "data");
    vfs.renameSync("/old.txt", "/new.txt");

    const entries = await adapter.loadAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe("/new.txt");
  });

  it("putFile with notify=false does NOT persist (hydration path)", async () => {
    vfs.putFile("/hydrated.txt", "data", false);
    expect(adapter.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Hydration tests
// ---------------------------------------------------------------------------
describe("MemFS hydration", () => {
  it("hydrate restores files from adapter", async () => {
    const adapter = new InMemoryAdapter();
    const enc = new TextEncoder();
    adapter.save({
      path: "/restored.txt",
      type: "file",
      content: enc.encode("hello"),
      mtime: Date.now(),
    });
    adapter.save({ path: "/dir", type: "directory", mtime: Date.now() });
    adapter.save({
      path: "/dir/nested.txt",
      type: "file",
      content: enc.encode("nested"),
      mtime: Date.now(),
    });

    const vfs = new MemFS({ persistence: adapter });
    const count = await vfs.hydrate();

    expect(count).toBe(3);
    expect(vfs.readFileSync("/restored.txt", "utf8")).toBe("hello");
    expect(vfs.readFileSync("/dir/nested.txt", "utf8")).toBe("nested");
  });

  it("hydrate restores symlinks", async () => {
    const adapter = new InMemoryAdapter();
    const enc = new TextEncoder();
    adapter.save({
      path: "/target.txt",
      type: "file",
      content: enc.encode("data"),
      mtime: Date.now(),
    });
    adapter.save({
      path: "/link",
      type: "symlink",
      target: "/target.txt",
      mtime: Date.now(),
    });

    const vfs = new MemFS({ persistence: adapter });
    await vfs.hydrate();

    expect(vfs.readFileSync("/link", "utf8")).toBe("data");
  });

  it("hydrate returns 0 when no adapter is configured", async () => {
    const vfs = new MemFS();
    const count = await vfs.hydrate();
    expect(count).toBe(0);
  });

  it("hydrate returns 0 when adapter is empty", async () => {
    const adapter = new InMemoryAdapter();
    const vfs = new MemFS({ persistence: adapter });
    const count = await vfs.hydrate();
    expect(count).toBe(0);
  });

  it("full write → hydrate round-trip", async () => {
    const adapter = new InMemoryAdapter();

    // Phase 1: write files
    const vfs1 = new MemFS({ persistence: adapter });
    vfs1.writeFileSync("/app/index.js", 'console.log("hello");');
    vfs1.writeFileSync("/app/package.json", '{"name":"test"}');

    // Phase 2: new VFS reads from same adapter (simulates page refresh)
    const vfs2 = new MemFS({ persistence: adapter });
    await vfs2.hydrate();

    expect(vfs2.readFileSync("/app/index.js", "utf8")).toBe(
      'console.log("hello");',
    );
    expect(vfs2.readFileSync("/app/package.json", "utf8")).toBe(
      '{"name":"test"}',
    );
  });
});

// ---------------------------------------------------------------------------
// Container + persistence integration
// ---------------------------------------------------------------------------
describe("Container with persistence", () => {
  it("accepts persistence option", () => {
    const adapter = new InMemoryAdapter();
    const c = boot({ persistence: adapter });
    expect(c).toBeInstanceOf(Container);
  });

  it("writeFile persists via adapter", () => {
    const adapter = new InMemoryAdapter();
    const c = boot({ persistence: adapter });
    c.writeFile("/test.txt", "data");
    expect(adapter.size).toBe(1);
  });

  it("flushPersistence is callable", async () => {
    const adapter = new InMemoryAdapter();
    const c = boot({ persistence: adapter });
    c.writeFile("/f.txt", "data");
    await c.vfs.flushPersistence();
    // Verify no errors — InMemoryAdapter.flush is a no-op
  });
});
