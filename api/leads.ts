import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getLeadsRepository } from "../src/server/data/leadsRepository";

const requestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  locale: z.enum(["es", "en"]),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }

  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false });
    return;
  }

  try {
    const repository = getLeadsRepository();
    const result = await repository.create(parsed.data);
    if (!result.ok) {
      // Invariant #3: never log the fields, only that the write failed.
      console.error("[leads] create failed");
      res.status(500).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true, duplicate: result.value.duplicate });
  } catch {
    console.error("[leads] repository is not configured");
    res.status(500).json({ ok: false });
  }
}
