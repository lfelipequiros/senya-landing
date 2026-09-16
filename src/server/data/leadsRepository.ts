import { randomUUID } from "node:crypto";
import { JWT } from "google-auth-library";
// Relative, not the `@shared/*` alias: this file is transitively loaded by vite.config.ts itself
// (via api/leads.ts, for the dev API shim), and Vite's own config loader doesn't apply the
// `resolve.alias` the config defines — only app code served afterwards gets that.
// The explicit `.js` extension (naming the compiled output, not the `.ts` source) is required too:
// package.json's `"type": "module"` puts Vercel's function bundler under Node's strict ESM resolver,
// which — unlike our tsconfig's `moduleResolution: "bundler"` or Vite/Vitest's own resolver — does not
// infer extensions on relative specifiers (confirmed via a TS2835 diagnostic in Vercel's own build log
// after `/api/leads` 500'd in production with ERR_MODULE_NOT_FOUND).
import { err, ok, type Result } from "../../shared/result.js";

export interface NewLead {
  name: string;
  email: string;
  phone: string;
  locale: "es" | "en";
}

export interface Lead extends NewLead {
  id: string;
  createdAt: string;
}

export type CreateLeadResult = Result<{ lead: Lead; duplicate: boolean }>;

export interface LeadsRepository {
  create(input: NewLead): Promise<CreateLeadResult>;
  findByEmail(email: string): Promise<Result<Lead | null>>;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Diagnostic-only: a gaxios/Sheets-API error's raw object can carry the request body and the bearer
// token (in `.config.data` / `.config.headers`) — never log it directly (invariants #1 and #3). Only
// the HTTP status and the API's own message (which describes the failure, not the submitted data) are
// safe to surface.
function describeError(error: unknown): string {
  const status = (error as { response?: { status?: number } })?.response?.status;
  const message = error instanceof Error ? error.message : String(error);
  return status ? `${status}: ${message}` : message;
}

function rowToLead(row: string[]): Lead {
  const [id, name, email, phone, locale, createdAt] = row;
  return {
    id: id ?? "",
    name: name ?? "",
    email: email ?? "",
    phone: phone ?? "",
    locale: locale === "en" ? "en" : "es",
    createdAt: createdAt ?? "",
  };
}

// ADR-007: one tab, one header row, columns in this order. Kept as a single tab (no per-locale or
// per-status split) because volume is low and the owner reads this sheet directly — more tabs would
// be more for a human to check, not less.
const SHEET_RANGE = "Leads!A:F";
const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

interface GoogleSheetsConfig {
  serviceAccountEmail: string;
  privateKey: string;
  spreadsheetId: string;
}

// The only class in the project allowed to hold Sheets-API credentials or call the Sheets API
// (ADR-007, CLAUDE.md invariant #2 — enforced mechanically by eslint.config.js).
export class GoogleSheetsLeadsRepository implements LeadsRepository {
  private readonly client: JWT;
  private readonly spreadsheetId: string;

  constructor(config: GoogleSheetsConfig) {
    this.client = new JWT({
      email: config.serviceAccountEmail,
      key: config.privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    this.spreadsheetId = config.spreadsheetId;
  }

  async findByEmail(email: string): Promise<Result<Lead | null>> {
    const target = normalizeEmail(email);
    try {
      const response = await this.client.request<{ values?: string[][] }>({
        url: `${SHEETS_API_BASE}/${this.spreadsheetId}/values/${encodeURIComponent(SHEET_RANGE)}`,
        method: "GET",
      });
      const rows = response.data.values ?? [];
      const match = rows.map(rowToLead).find((lead) => normalizeEmail(lead.email) === target);
      return ok(match ?? null);
    } catch (error) {
      // Invariant #3: never log the email being looked up, only that the read failed and why.
      console.error("[leads] sheet read failed:", describeError(error));
      return err("leads: failed to read the sheet");
    }
  }

  async create(input: NewLead): Promise<CreateLeadResult> {
    const existing = await this.findByEmail(input.email);
    if (!existing.ok) return err(existing.error);
    if (existing.value) return ok({ lead: existing.value, duplicate: true });

    const lead: Lead = {
      id: randomUUID(),
      name: input.name.trim(),
      email: normalizeEmail(input.email),
      phone: input.phone.trim(),
      locale: input.locale,
      createdAt: new Date().toISOString(),
    };

    try {
      await this.client.request({
        url: `${SHEETS_API_BASE}/${this.spreadsheetId}/values/${encodeURIComponent(SHEET_RANGE)}:append`,
        method: "POST",
        params: { valueInputOption: "RAW" },
        data: { values: [[lead.id, lead.name, lead.email, lead.phone, lead.locale, lead.createdAt]] },
      });
      return ok({ lead, duplicate: false });
    } catch (error) {
      console.error("[leads] sheet write failed:", describeError(error));
      return err("leads: failed to write to the sheet");
    }
  }
}

// Tests/fixture (ADR-007, unchanged from ADR-003's shape).
export class InMemoryLeadsRepository implements LeadsRepository {
  private readonly rows = new Map<string, Lead>();

  async findByEmail(email: string): Promise<Result<Lead | null>> {
    const target = normalizeEmail(email);
    const match = [...this.rows.values()].find((lead) => lead.email === target);
    return ok(match ?? null);
  }

  async create(input: NewLead): Promise<CreateLeadResult> {
    const existing = await this.findByEmail(input.email);
    if (!existing.ok) return err(existing.error);
    if (existing.value) return ok({ lead: existing.value, duplicate: true });

    const lead: Lead = {
      id: randomUUID(),
      name: input.name.trim(),
      email: normalizeEmail(input.email),
      phone: input.phone.trim(),
      locale: input.locale,
      createdAt: new Date().toISOString(),
    };
    this.rows.set(lead.id, lead);
    return ok({ lead, duplicate: false });
  }
}

export function getLeadsRepository(): LeadsRepository {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!serviceAccountEmail || !privateKey || !spreadsheetId) {
    throw new Error("leads: Google Sheets credentials are not configured");
  }

  return new GoogleSheetsLeadsRepository({
    serviceAccountEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
    spreadsheetId,
  });
}
