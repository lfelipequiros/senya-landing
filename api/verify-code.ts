import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";

const requestSchema = z.object({
  code: z.string(),
});

export function normalizeCode(code: string): string {
  return code.trim().toLowerCase();
}

export function codeMatches(candidate: string, secret: string): boolean {
  return normalizeCode(candidate) === normalizeCode(secret);
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }

  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false });
    return;
  }

  const accessCode = process.env.ACCESS_CODE;
  if (!accessCode) {
    console.error("[verify-code] ACCESS_CODE is not configured");
    res.status(500).json({ ok: false });
    return;
  }

  res.status(200).json({ ok: codeMatches(parsed.data.code, accessCode) });
}
