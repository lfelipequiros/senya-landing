import { err, ok, type Result } from "@shared/result";

export async function verifyCode(code: string): Promise<Result<boolean>> {
  try {
    const response = await fetch("/api/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      return err(`verify-code responded with ${response.status}`);
    }

    const data = (await response.json()) as { ok: boolean };
    return ok(data.ok);
  } catch {
    return err("verify-code request failed");
  }
}
