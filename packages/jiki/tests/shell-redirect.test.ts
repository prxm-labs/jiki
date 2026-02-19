import { describe, it, expect, beforeEach } from "vitest";
import { Shell } from "../src/shell";
import { MemFS } from "../src/memfs";
import { Kernel } from "../src/kernel";
import { PackageManager } from "../src/npm/index";

describe("shell redirects", () => {
  let vfs: MemFS;
  let shell: Shell;

  beforeEach(() => {
    vfs = new MemFS();
    const kernel = new Kernel(vfs, {});
    const pm = new PackageManager(vfs, {});
    shell = new Shell(vfs, kernel, pm, { cwd: "/" });
  });

  it("> redirects stdout to file", async () => {
    await shell.exec("echo hello > /out.txt");
    expect(vfs.readFileSync("/out.txt", "utf-8")).toContain("hello");
  });

  it(">> appends to file", async () => {
    vfs.writeFileSync("/out.txt", "existing\n");
    await shell.exec("echo appended >> /out.txt");
    const content = vfs.readFileSync("/out.txt", "utf-8") as string;
    expect(content).toContain("existing");
    expect(content).toContain("appended");
  });
});
