import "server-only";

import { usingClaude } from "../env";
import { activeProvider, completeJson, parseJsonObject } from "../llm";
import { logger } from "../logger";
import {
  propertySearchRequirementSchema,
  type ParsedRequirement,
} from "@/domain/schemas";
import {
  extractRequirementWithRules,
  statesCurrencyExplicitly,
  statesPeriodExplicitly,
} from "./ruleExtractor";
import { formatMoney, marketDefaults } from "@/domain/money";

/**
 * Natural-language requirement extraction.
 *
 * The configured language model produces the structure when a key is present;
 * the deterministic parser produces it otherwise, and also rescues the request
 * when the model returns something that fails schema validation. Model output
 * is never used without passing `propertySearchRequirementSchema` first.
 */

export interface ExtractionOutcome {
  requirement: ParsedRequirement;
  source: "model" | "rules";
}

const SYSTEM_PROMPT = [
  "You convert a renter's plain-English description into a structured property search requirement.",
  "Renters may be searching in any country. Rent may be quoted per month or per year,",
  "and in any currency.",
  "",
  "Rules:",
  "- Return ONLY a JSON object. No prose, no code fences.",
  '- Money must be a plain number: "8 million" is 8000000, "800k" is 800000,',
  '  "1,450" is 1450. Never convert between currencies.',
  '- currency is the ISO 4217 code implied by the symbol or words the user used',
  '  ($ USD, EUR, GBP, NGN, AED, ZAR, KES, SGD, CAD, AUD, INR, MXN, BRL, JPY).',
  '  Omit it if no currency was indicated.',
  '- rentPeriod: "monthly" when they say per month or the figure looks monthly',
  '  for that market; "yearly" when they say per year. Prefer what they said.',
  "- Omit any field the user did not express. Never invent a budget, a bedroom count or an area.",
  '- amenities is a short list of lowercase phrases, e.g. ["parking", "prepaid meter", "security"].',
  "- additionalRequirements holds anything else material that is not a structured field.",
  "",
  "Shape:",
  "{",
  '  "location": string,',
  '  "propertyType"?: string,',
  '  "bedrooms"?: integer,',
  '  "bathrooms"?: integer,',
  '  "minRent"?: number,',
  '  "maxRent"?: number,',
  '  "currency"?: string,',
  '  "rentPeriod": "monthly" | "yearly",',
  '  "moveInDate"?: string,',
  '  "amenities": string[],',
  '  "additionalRequirements": string[]',
  "}",
].join("\n");


/**
 * Fill in what the market implies but the renter did not say.
 *
 * A language model is good at language and has no idea that Dubai quotes rent
 * by the year in dirhams while Lisbon quotes by the month in euros. Asked for
 * "3 bedroom in Dubai under 160000" it returns no currency, and the schema's
 * default would silently make that US dollars — a 3.7x error in the budget the
 * search is filtered on.
 *
 * Only genuinely absent fields are filled. A currency the renter stated, in
 * words or as a symbol, always wins.
 */
function applyMarketConventions(candidate: unknown, rawText: string): unknown {
  if (!candidate || typeof candidate !== "object") return candidate;
  const record = { ...(candidate as Record<string, unknown>) };

  const location = typeof record.location === "string" ? record.location : "";
  const market = marketDefaults(location);
  if (!market) return record;

  // The market wins whenever the renter did not state one themselves. An
  // absent value is obviously a gap, but so is a value the model supplied
  // without evidence: asked for "3 bed in Lekki under 8 million" a model will
  // confidently answer "monthly", when Lagos quotes by the year.
  if (!statesCurrencyExplicitly(rawText)) {
    record.currency = market.currency;
  }
  if (!statesPeriodExplicitly(rawText)) {
    record.rentPeriod = market.period;
  }
  return record;
}

async function extractWithModel(text: string): Promise<ParsedRequirement | null> {
  const response = await completeJson({
    system: SYSTEM_PROMPT,
    user: text,
    maxTokens: 700,
  });

  const candidate = parseJsonObject(response);
  if (candidate === null) return null;

  const result = propertySearchRequirementSchema.safeParse(
    applyMarketConventions(candidate, text),
  );
  if (!result.success) {
    logger.warn("extraction.model_schema_invalid", {
      provider: activeProvider(),
      issues: result.error.issues.length,
    });
    return null;
  }
  return result.data;
}

/**
 * Convert free text into a validated requirement.
 *
 * Throws only when neither path can produce something usable, which in
 * practice means the text contained no recognisable location.
 */
export async function extractRequirement(text: string): Promise<ExtractionOutcome | null> {
  if (usingClaude()) {
    try {
      const requirement = await extractWithModel(text);
      if (requirement) return { requirement, source: "model" };
      logger.warn("extraction.model_unusable_falling_back", { provider: activeProvider() });
    } catch (error) {
      logger.warn("extraction.model_failed", {
        provider: activeProvider(),
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const fallback = extractRequirementWithRules(text);
  return fallback ? { requirement: fallback, source: "rules" } : null;
}

/**
 * Merge structured form fields over an extracted requirement. Explicit form
 * input always wins over anything inferred from prose.
 */
export function mergeRequirements(
  base: ParsedRequirement | null,
  overrides: Partial<ParsedRequirement> | undefined,
): ParsedRequirement | null {
  if (!overrides) return base;

  const merged: Record<string, unknown> = { ...(base ?? {}) };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    merged[key] = value;
  }

  const result = propertySearchRequirementSchema.safeParse(merged);
  return result.success ? result.data : base;
}

/** One-line human summary used in the dashboard header. */
export function describeRequirement(requirement: ParsedRequirement): string {
  const parts: string[] = [];
  if (requirement.bedrooms !== undefined) parts.push(requirement.bedrooms + " bedroom");
  if (requirement.propertyType) parts.push(requirement.propertyType);
  parts.push(requirement.location);
  if (requirement.maxRent !== undefined) {
    parts.push(
      "under " +
        formatMoney(requirement.maxRent, requirement.currency) +
        "/" +
        (requirement.rentPeriod === "monthly" ? "month" : "year"),
    );
  }
  return parts.join(" • ");
}
