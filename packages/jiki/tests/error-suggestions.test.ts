import { describe, it, expect } from "vitest";
import { parseError, formatErrorText } from "../src/errors";

describe("Error suggestions", () => {
  it("suggests npm install for missing module", () => {
    const err = parseError("runtime", new Error("Cannot find module 'react'"));
    expect(err.suggestions).toContain("Run: npm install react");
  });

  it("suggests npm install for scoped package", () => {
    const err = parseError(
      "runtime",
      new Error("Cannot find module '@tanstack/react-query'"),
    );
    expect(err.suggestions).toContain("Run: npm install @tanstack/react-query");
  });

  it("suggests checking file exists for relative import", () => {
    const err = parseError(
      "runtime",
      new Error("Cannot find module './utils'"),
    );
    expect(err.suggestions).toContain('Check that the file "./utils" exists');
  });

  it("suggests import for undefined capitalized name", () => {
    const ref = new ReferenceError("React is not defined");
    const err = parseError("runtime", ref);
    expect(err.suggestions).toContain("Did you forget to import React?");
  });

  it("suggests init for transpiler not initialized", () => {
    const err = parseError(
      "build",
      new Error("Transpiler not initialized. Call kernel.init()"),
    );
    expect(err.suggestions).toContain(
      "Call await container.init() before running TypeScript files",
    );
  });

  it("suggests network check for install fetch errors", () => {
    const err = parseError(
      "install",
      new Error("Failed to fetch package react"),
    );
    expect(err.suggestions).toContain("Check your internet connection");
  });

  it("suggests path addition for sandbox path error", () => {
    const err = parseError(
      "runtime",
      new Error(
        "[sandbox] Write to '/etc/passwd' rejected: outside allowed paths",
      ),
    );
    expect(err.suggestions).toContain(
      "Add the path to sandbox.fs.allowedPaths",
    );
  });

  it("returns empty suggestions for unknown errors", () => {
    const err = parseError("runtime", new Error("Something unexpected"));
    expect(err.suggestions).toEqual([]);
  });

  it("includes suggestions in formatErrorText", () => {
    const err2 = parseError(
      "runtime",
      new Error("Cannot find module 'lodash'"),
    );
    const text = formatErrorText(err2);
    expect(text).toContain("Suggestions:");
    expect(text).toContain("npm install lodash");
  });
});
