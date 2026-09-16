import { describe, expect, it } from "vitest";
import { InMemoryLeadsRepository } from "./leadsRepository";

describe("InMemoryLeadsRepository", () => {
  it("creates a new lead", async () => {
    const repo = new InMemoryLeadsRepository();
    const result = await repo.create({
      name: "Camila",
      email: "Camila@Example.com",
      phone: "+54 9 11 2345 6789",
      locale: "es",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.duplicate).toBe(false);
      expect(result.value.lead.email).toBe("camila@example.com");
    }
  });

  it("reports a duplicate for the same email, ignoring case and whitespace", async () => {
    const repo = new InMemoryLeadsRepository();
    await repo.create({ name: "Camila", email: "camila@example.com", phone: "123", locale: "es" });
    const result = await repo.create({
      name: "Camila",
      email: "  CAMILA@Example.com  ",
      phone: "456",
      locale: "es",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.duplicate).toBe(true);
    }
  });

  it("findByEmail returns null when nothing matches", async () => {
    const repo = new InMemoryLeadsRepository();
    const result = await repo.findByEmail("nobody@example.com");
    expect(result).toEqual({ ok: true, value: null });
  });
});
