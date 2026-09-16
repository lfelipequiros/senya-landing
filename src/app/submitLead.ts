import { err, ok, type Result } from "@shared/result";

export interface LeadInput {
  name: string;
  email: string;
  phone: string;
}

export interface SubmitLeadResult {
  duplicate: boolean;
}

export async function submitLead(input: LeadInput): Promise<Result<SubmitLeadResult>> {
  try {
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // TODO(PDR-004): locale is hardcoded until the bilingual scaffolding lands and can pass the
      // visitor's real detected/selected language.
      body: JSON.stringify({ ...input, locale: "es" }),
    });

    if (!response.ok) {
      return err(`leads responded with ${response.status}`);
    }

    const data = (await response.json()) as { ok: boolean; duplicate?: boolean };
    if (!data.ok) {
      return err("leads reported failure");
    }
    return ok({ duplicate: Boolean(data.duplicate) });
  } catch {
    return err("leads request failed");
  }
}
