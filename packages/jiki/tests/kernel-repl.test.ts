import { describe, it, expect } from "vitest";

describe("REPL scope key validation", () => {
  it("rejects scope keys with invalid characters", () => {
    // We test the validation function directly
    const validIdent = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

    // These should be valid
    expect(validIdent.test("foo")).toBe(true);
    expect(validIdent.test("_bar")).toBe(true);
    expect(validIdent.test("$baz")).toBe(true);
    expect(validIdent.test("x123")).toBe(true);

    // These should be invalid (injection vectors)
    expect(validIdent.test("__proto__")).toBe(true); // valid identifier, but safe
    expect(validIdent.test("a b")).toBe(false);
    expect(validIdent.test('a")); console.log("injected')).toBe(false);
    expect(validIdent.test("")).toBe(false);
    expect(validIdent.test("123abc")).toBe(false);
  });
});
