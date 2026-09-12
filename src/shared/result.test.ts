import { describe, expect, it } from "vitest";
import { err, ok } from "./result";

describe("Result<T>", () => {
  it("wraps a success value", () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(42);
  });

  it("wraps a failure value", () => {
    const result = err("boom");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("boom");
  });
});
