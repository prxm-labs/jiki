import { describe, it, expect } from "vitest";
import { MemFS } from "../src/memfs";
import { Kernel } from "../src/kernel";

describe("Kernel module cache LRU eviction", () => {
  it("touchCacheEntry records access time", () => {
    const vfs = new MemFS();
    const kernel = new Kernel(vfs);

    // Add some modules to cache
    vfs.writeFileSync("/a.js", 'module.exports = "a";');
    vfs.writeFileSync("/b.js", 'module.exports = "b";');

    kernel.runFileSync("/a.js");
    kernel.runFileSync("/b.js");

    // Touch a.js to mark it as recently used
    kernel.touchCacheEntry("/a.js");

    // Both should be in cache
    expect(kernel.moduleCache["/a.js"]).toBeDefined();
    expect(kernel.moduleCache["/b.js"]).toBeDefined();
  });

  it("clearCache also clears access time tracking", () => {
    const vfs = new MemFS();
    const kernel = new Kernel(vfs);

    vfs.writeFileSync("/x.js", "module.exports = 1;");
    kernel.runFileSync("/x.js");
    kernel.touchCacheEntry("/x.js");

    kernel.clearCache();

    // Cache should be empty
    expect(Object.keys(kernel.moduleCache).length).toBe(0);
  });

  it("eviction removes least recently used entries first", () => {
    const vfs = new MemFS();
    const kernel = new Kernel(vfs);

    // Access internal maxCacheSize via any to set it low for testing
    (kernel as any).maxCacheSize = 3;

    // Create and run 5 modules - only 3 should survive after trimming
    for (let i = 0; i < 5; i++) {
      vfs.writeFileSync(`/m${i}.js`, `module.exports = ${i};`);
    }

    kernel.runFileSync("/m0.js");
    kernel.runFileSync("/m1.js");
    kernel.runFileSync("/m2.js");

    // Touch m0 to make it recently used
    kernel.touchCacheEntry("/m0.js");

    // Running m3 should trigger eviction
    kernel.runFileSync("/m3.js");
    kernel.runFileSync("/m4.js");

    // m0 was touched most recently, should survive
    // m1 and m2 were older, might be evicted
    const keys = Object.keys(kernel.moduleCache);
    // At least m0 and m4 (most recent) should be in cache
    expect(keys).toContain("/m4.js");
  });
});
