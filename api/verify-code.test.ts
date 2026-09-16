import { describe, expect, it } from "vitest";
import { codeMatches } from "./verify-code";

describe("codeMatches", () => {
  it("matches the exact code", () => {
    expect(codeMatches("amoelarte", "amoelarte")).toBe(true);
  });

  it("ignores casing", () => {
    expect(codeMatches("AmoElArte", "amoelarte")).toBe(true);
  });

  it("ignores surrounding whitespace", () => {
    expect(codeMatches("  amoelarte  ", "amoelarte")).toBe(true);
  });

  it("rejects a wrong code", () => {
    expect(codeMatches("wrongcode", "amoelarte")).toBe(false);
  });

  it("rejects an empty code", () => {
    expect(codeMatches("", "amoelarte")).toBe(false);
  });
});
