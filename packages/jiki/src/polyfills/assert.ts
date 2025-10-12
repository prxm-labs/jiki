import { isDeepStrictEqual } from "./util";

class AssertionError extends Error {
  actual: unknown;
  expected: unknown;
  operator: string;
  constructor(
    message: string,
    actual?: unknown,
    expected?: unknown,
    operator?: string,
  ) {
    super(message);
    this.name = "AssertionError";
    this.actual = actual;
    this.expected = expected;
    this.operator = operator || "";
  }
}

function assert(value: unknown, message?: string): asserts value {
  if (!value)
    throw new AssertionError(
      message || `Expected truthy value, got ${value}`,
      value,
      true,
      "==",
    );
}

assert.ok = assert;
assert.equal = (actual: unknown, expected: unknown, message?: string) => {
  if (actual != expected)
    throw new AssertionError(
      message || `${actual} != ${expected}`,
      actual,
      expected,
      "==",
    );
};
assert.notEqual = (actual: unknown, expected: unknown, message?: string) => {
  if (actual == expected)
    throw new AssertionError(
      message || `${actual} == ${expected}`,
      actual,
      expected,
      "!=",
    );
};
assert.strictEqual = (actual: unknown, expected: unknown, message?: string) => {
  if (actual !== expected)
    throw new AssertionError(
      message || `${actual} !== ${expected}`,
      actual,
      expected,
      "===",
    );
};
assert.notStrictEqual = (
  actual: unknown,
  expected: unknown,
  message?: string,
) => {
  if (actual === expected)
    throw new AssertionError(
      message || `${actual} === ${expected}`,
      actual,
      expected,
      "!==",
    );
};
assert.deepEqual = (actual: unknown, expected: unknown, message?: string) => {
  if (!isDeepStrictEqual(actual, expected))
    throw new AssertionError(
      message || "Values not deep equal",
      actual,
      expected,
      "deepEqual",
    );
};
assert.deepStrictEqual = assert.deepEqual;
assert.notDeepEqual = (
  actual: unknown,
  expected: unknown,
  message?: string,
) => {
  if (isDeepStrictEqual(actual, expected))
    throw new AssertionError(
      message || "Values are deep equal",
      actual,
      expected,
      "notDeepEqual",
    );
};
assert.notDeepStrictEqual = assert.notDeepEqual;
assert.throws = (
  fn: () => void,
  errorOrMessage?: unknown,
  message?: string,
) => {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw)
    throw new AssertionError(
      typeof errorOrMessage === "string"
        ? errorOrMessage
        : message || "Expected function to throw",
    );
};
assert.doesNotThrow = (fn: () => void, message?: string) => {
  try {
    fn();
  } catch (e) {
    throw new AssertionError(message || `Function threw: ${e}`);
  }
};
assert.rejects = async (
  fn: (() => Promise<unknown>) | Promise<unknown>,
  message?: string,
) => {
  try {
    await (typeof fn === "function" ? fn() : fn);
  } catch {
    return;
  }
  throw new AssertionError(
    typeof message === "string" ? message : "Expected promise to reject",
  );
};
assert.doesNotReject = async (
  fn: (() => Promise<unknown>) | Promise<unknown>,
  message?: string,
) => {
  try {
    await (typeof fn === "function" ? fn() : fn);
  } catch (e) {
    throw new AssertionError(
      typeof message === "string" ? message : `Promise rejected: ${e}`,
    );
  }
};
assert.ifError = (value: unknown) => {
  if (value) throw value;
};
assert.fail = (message?: string) => {
  throw new AssertionError(message || "Failed");
};
assert.match = (string: string, regexp: RegExp, message?: string) => {
  if (!regexp.test(string))
    throw new AssertionError(message || `${string} does not match ${regexp}`);
};
assert.doesNotMatch = (string: string, regexp: RegExp, message?: string) => {
  if (regexp.test(string))
    throw new AssertionError(message || `${string} matches ${regexp}`);
};
assert.AssertionError = AssertionError;
assert.strict = assert;

export { AssertionError };
export default assert;
