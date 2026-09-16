import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const createMock = vi.fn();
const getLeadsRepositoryMock = vi.fn(() => ({ create: createMock, findByEmail: vi.fn() }));

vi.mock("../src/server/data/leadsRepository", () => ({
  getLeadsRepository: getLeadsRepositoryMock,
}));

const { default: handler } = await import("./leads");

type MockRes = VercelResponse & { statusCode?: number; body?: unknown };

function mockRes(): MockRes {
  const res = {} as MockRes;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  }) as MockRes["status"];
  res.json = vi.fn((payload: unknown) => {
    res.body = payload;
    return res;
  }) as MockRes["json"];
  return res;
}

const validBody = {
  name: "Camila",
  email: "camila@example.com",
  phone: "+54 9 11 2345 6789",
  locale: "es",
};

describe("POST /api/leads", () => {
  beforeEach(() => {
    createMock.mockReset();
    getLeadsRepositoryMock.mockClear();
  });

  it("rejects non-POST methods", async () => {
    const res = mockRes();
    await handler({ method: "GET" } as VercelRequest, res);
    expect(res.statusCode).toBe(405);
  });

  it("rejects an invalid body", async () => {
    const res = mockRes();
    await handler({ method: "POST", body: { name: "" } } as VercelRequest, res);
    expect(res.statusCode).toBe(400);
  });

  it("returns ok and duplicate:false on a fresh signup", async () => {
    createMock.mockResolvedValue({ ok: true, value: { lead: { id: "1" }, duplicate: false } });
    const res = mockRes();
    await handler({ method: "POST", body: validBody } as VercelRequest, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, duplicate: false });
  });

  it("returns ok and duplicate:true on a repeat email", async () => {
    createMock.mockResolvedValue({ ok: true, value: { lead: { id: "1" }, duplicate: true } });
    const res = mockRes();
    await handler({ method: "POST", body: validBody } as VercelRequest, res);
    expect(res.body).toEqual({ ok: true, duplicate: true });
  });

  it("returns 500 without leaking details when the write fails", async () => {
    createMock.mockResolvedValue({ ok: false, error: "leads: failed to write to the sheet" });
    const res = mockRes();
    await handler({ method: "POST", body: validBody } as VercelRequest, res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ ok: false });
  });

  it("returns 500 when the repository is not configured", async () => {
    getLeadsRepositoryMock.mockImplementationOnce(() => {
      throw new Error("leads: Google Sheets credentials are not configured");
    });
    const res = mockRes();
    await handler({ method: "POST", body: validBody } as VercelRequest, res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ ok: false });
  });
});
