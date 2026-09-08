import "server-only";

import {
  callVerificationResultSchema,
  buildCallResultJsonSchema,
  type CallVerificationResult,
} from "@/domain/schemas";
import type { PropertyListing, TranscriptTurn } from "@/domain/types";
import { llmConfigured } from "../env";
import { activeModel, activeProvider, completeJson, parseJsonObject } from "../llm";
import { logger } from "../logger";

/**
 * Turns a verification call transcript into structured property facts.
 *
 * CALL-E performs the conversation but, on this plan, does not perform
 * server-side structured extraction: both `result_schema` and
 * `recipient_result_schema` are rejected, and `structuredResult` comes back
 * null. Extraction therefore happens here, which also means Propster owns the
 * step and can validate it.
 *
 * The input is speech recognition output from a live phone line, so it is
 * noisy in specific, predictable ways — "there is preparing me sir" for "there
 * is a prepaid meter, sir", "58" for "five bedrooms, five bathrooms". The
 * prompt below is written around that noise. A regex parser cannot survive it,
 * which is why a language model is the primary path. Which model serves the
 * request is configuration; see `src/server/llm.ts`.
 *
 * Whatever comes back is validated against `callVerificationResultSchema`
 * before it is used. Model output is never trusted directly.
 */

export type ExtractionSource = "model" | "rules";

export interface TranscriptExtraction {
  facts: CallVerificationResult;
  source: ExtractionSource;
}

const SYSTEM_PROMPT = [
  "You extract structured facts from a phone call transcript.",
  "",
  "An AI assistant called a letting agent to verify a rental listing. The",
  "property may be in any country, and rent may be quoted per month or per year.",
  "Your job is to report ONLY what the person who answered actually said.",
  "",
  "THE TRANSCRIPT IS AUTOMATIC SPEECH RECOGNITION OUTPUT AND IS NOISY.",
  "Expect dropped words, phonetic errors and run-together numbers. Correct them",
  "only when the intended meaning is unambiguous from context. Examples:",
  '  "there is preparing me sir"        -> a prepaid meter is present',
  '  "prepaid metre" / "pre paid meter" -> prepaid meter',
  '  "fourteen fifty a month"           -> 1450, rent_period monthly',
  '  "ten million naira"                -> 10000000',
  '  "two thousand four hundred"        -> 2400',
  '  "5 bedrooms and five bathrooms"    -> bedrooms 5, bathrooms 5',
  "",
  "CRITICAL RULES:",
  "- Report what the CONTACT said, never what the assistant asked. A question",
  "  the assistant asked is not evidence that it was answered.",
  "- If a question was asked but never clearly answered, use null. Do NOT guess,",
  "  and do NOT fall back to the listing's own values.",
  "- If the contact corrected themselves, use the CORRECTED value.",
  "- rent_period matters enormously. If the contact says a rent is monthly, set",
  '  rent_period to "monthly" even when the listing advertises a yearly figure.',
  "  Do not silently convert between periods; report the period they stated.",
  "- current_rent is a plain number in the listing's own currency, for ONE",
  '  period. Never convert between currencies or between months and years.',
  '  "10 million monthly" is current_rent 10000000, rent_period "monthly".',
  "- property_available is false ONLY if the contact says the property is gone,",
  "  let, taken or off the market. If they say they do not know, cannot check,",
  "  are not the right person, or simply never answer, use null. Not knowing is",
  "  NOT a no, and a wrong 'no longer available' is the worst error you can make.",
  "- reached_contact is false only if nobody engaged with the questions at all.",
  "",
  "Return ONLY a JSON object matching this schema. No prose, no code fences:",
  JSON.stringify(buildCallResultJsonSchema(), null, 2),
].join("\n");

/** Render the transcript with clear speaker labels for the model. */
function renderTranscript(turns: readonly TranscriptTurn[]): string {
  return turns
    .map((turn) => {
      const who =
        turn.speaker === "agent" ? "ASSISTANT" : turn.speaker === "contact" ? "CONTACT" : "UNKNOWN";
      return who + ": " + turn.text.trim();
    })
    .filter((line) => line.length > 12)
    .join("\n");
}

/** Context so the model knows which property is being discussed. */
function renderListingContext(listing: PropertyListing): string {
  return [
    "The listing being verified (for context only — do NOT copy these values",
    "into your answer, they are the claims under test):",
    "- Advertised rent: " +
      listing.rent +
      " " +
      listing.currency +
      " per " +
      listing.rentPeriod.replace("ly", ""),
    listing.country === undefined ? "" : "- Country: " + listing.country,
    "- Advertised bedrooms: " + listing.bedrooms,
    listing.bathrooms === undefined ? "" : "- Advertised bathrooms: " + listing.bathrooms,
    "- Advertised amenities: " + (listing.amenities.join(", ") || "none"),
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Phrases in which a contact actually states the property has gone.
 *
 * Deliberately about the property, not about the contact's knowledge: "I don't
 * know" and "I can't check that" are absent, because not knowing is not a no.
 */
const SAID_UNAVAILABLE =
  /\b(no longer available|not available|isn'?t available|it'?s gone|has gone|been (let|taken|rented|sold)|off the market|already (let|taken|rented|sold)|we let it|somebody took it)\b/i;

/**
 * Refuse a "no longer available" the contact never actually said.
 *
 * Marking a property unavailable is the single most consequential claim
 * Propster makes: it zeroes the availability score, drives the headline status,
 * and prints "the contact said this property is no longer on the market". On a
 * real call to a contact who answered "I don't have information about apartment
 * availability, so I can't verify that for you", the model returned
 * `property_available: false` — inventing a rejection out of an admission of
 * ignorance, against an explicit instruction not to guess.
 *
 * The prompt already forbids this, and the prompt was not enough. So the claim
 * is checked against what was actually spoken: a false only survives if some
 * contact turn really says the property has gone. Otherwise it becomes null,
 * which scores as unconfirmed. The failure direction matters — an unconfirmed
 * property is merely unproven, a falsely unavailable one is wrong.
 */
export function guardAvailabilityClaim(
  facts: CallVerificationResult,
  turns: readonly TranscriptTurn[],
): CallVerificationResult {
  if (facts.property_available !== false) return facts;

  const spoken = turns
    .filter((turn) => turn.speaker === "contact")
    .map((turn) => turn.text)
    .join(" ");

  if (SAID_UNAVAILABLE.test(spoken)) return facts;

  logger.warn("transcript.unsupported_unavailable_claim", {
    provider: activeProvider(),
    model: activeModel(),
  });
  return { ...facts, property_available: null };
}

async function extractWithModel(
  turns: readonly TranscriptTurn[],
  listing: PropertyListing,
): Promise<CallVerificationResult | null> {
  const text = await completeJson({
    system: SYSTEM_PROMPT,
    user:
      renderListingContext(listing) +
      "\n\n--- TRANSCRIPT ---\n" +
      renderTranscript(turns) +
      "\n--- END TRANSCRIPT ---",
    maxTokens: 1500,
  });

  const candidate = parseJsonObject(text);
  if (candidate === null) return null;

  const result = callVerificationResultSchema.safeParse(candidate);
  if (!result.success) {
    logger.warn("transcript.model_schema_invalid", {
      provider: activeProvider(),
      model: activeModel(),
      issues: result.error.issues.length,
    });
    return null;
  }
  return guardAvailabilityClaim(result.data, turns);
}

/**
 * Deterministic fallback used when no model is configured, or when the model is
 * unavailable or returns something unusable.
 *
 * It reads only the contact's turns and only claims a fact when the phrasing is
 * unambiguous, so it under-reports rather than inventing. On a clean line it
 * recovers availability, rent and the yes/no amenities; on a badly garbled one
 * it will return mostly nulls, which correctly scores as "unconfirmed" rather
 * than as a false verification.
 */
export function extractWithRules(
  turns: readonly TranscriptTurn[],
): CallVerificationResult | null {
  const said = turns
    .filter((turn) => turn.speaker === "contact")
    .map((turn) => turn.text.toLowerCase())
    .join(" ");

  if (said.trim().length === 0) return null;

  const facts: Record<string, unknown> = { reached_contact: true };

  // --- Availability -------------------------------------------------------
  if (/\b(no longer available|not available|it'?s gone|been (let|taken|rented))\b/.test(said)) {
    facts.property_available = false;
  } else if (/\b(still available|it is available|yes,? it is|available)\b/.test(said)) {
    facts.property_available = true;
  } else {
    facts.property_available = null;
  }

  // --- Rent ---------------------------------------------------------------
  //
  // Only an EXPLICIT money phrase counts: a number carrying a magnitude word or
  // "naira". An earlier version keyed off nearby words like "rent" or "is",
  // which on a garbled transcript matched stray digits from unrelated speech
  // ("microsoft 9 rig") and reported the wrong rent with full confidence. A
  // wrong number is worse than no number, because the score treats it as
  // confirmed.
  // A magnitude word ("two million", "800k"), or a plain figure followed by a
  // currency word in any of the markets Propster covers.
  const moneyPhrase =
    /\b(\d+(?:[.,]\d+)?)\s*(million|m|k|thousand)\b|\b(\d[\d,]{2,})\s*(?:naira|euros?|pounds?|dollars?|dirhams?|rand|shillings?|rupees?|pesos?|reais?|yen)\b/gi;
  const candidates: number[] = [];
  for (const match of said.matchAll(moneyPhrase)) {
    if (match[1] && match[2]) {
      const raw = Number(match[1].replace(/,/g, ""));
      if (!Number.isFinite(raw) || raw <= 0) continue;
      const unit = match[2].toLowerCase();
      candidates.push(unit === "k" || unit === "thousand" ? raw * 1_000 : raw * 1_000_000);
    } else if (match[3]) {
      const raw = Number(match[3].replace(/,/g, ""));
      if (Number.isFinite(raw) && raw > 0) candidates.push(raw);
    }
  }
  // A rent is the largest plausible sum mentioned; smaller figures in the same
  // call are fees, car counts or room counts.
  const rent = candidates.filter((value) => value >= 100_000).sort((a, b) => b - a)[0];
  if (rent !== undefined) facts.current_rent = rent;
  if (/\b(per month|monthly|a month|every month)\b/.test(said)) facts.rent_period = "monthly";
  else if (/\b(per year|yearly|annually|per annum|a year)\b/.test(said)) facts.rent_period = "yearly";

  // --- Rooms --------------------------------------------------------------
  const beds = /(\d+)\s*bed\s?room/.exec(said);
  if (beds?.[1]) facts.bedrooms = Number(beds[1]);
  const baths = /(\d+)\s*bath\s?room/.exec(said);
  if (baths?.[1]) facts.bathrooms = Number(baths[1]);

  // --- Amenities ----------------------------------------------------------
  // "preparing"/"prepared" are the recurring ASR mangling of "prepaid".
  if (/\bpre[\s-]?paid|prepaid met|preparing me|prepared meter\b/.test(said)) {
    facts.electricity_type = "prepaid meter";
  } else if (/\b(postpaid|estate billing|estate bill)\b/.test(said)) {
    facts.electricity_type = "estate billing";
  }

  if (/\bno (dedicated )?parking|street parking|no space for car\b/.test(said)) {
    facts.parking_available = false;
  } else if (/\bparking\b/.test(said) && /\byes\b/.test(said)) {
    facts.parking_available = true;
  }

  if (/\bborehole\b/.test(said)) facts.water_supply = "borehole";
  if (/\bno security\b/.test(said)) facts.security_available = false;
  else if (/\b(security|gateman|guard)\b/.test(said)) facts.security_available = true;

  const parsed = callVerificationResultSchema.safeParse(facts);
  return parsed.success ? parsed.data : null;
}

/**
 * Extract facts from a transcript. Claude first, deterministic rules as the
 * safety net. Returns null only when neither path can produce anything valid,
 * which the caller must treat as a failed verification rather than a pass.
 */
export async function extractFactsFromTranscript(
  turns: readonly TranscriptTurn[],
  listing: PropertyListing,
): Promise<TranscriptExtraction | null> {
  if (turns.length === 0) return null;

  if (llmConfigured()) {
    try {
      const facts = await extractWithModel(turns, listing);
      if (facts) return { facts, source: "model" };
      logger.warn("transcript.model_unusable_falling_back", { provider: activeProvider() });
    } catch (error) {
      logger.warn("transcript.model_failed", {
        provider: activeProvider(),
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const fallback = extractWithRules(turns);
  return fallback ? { facts: fallback, source: "rules" } : null;
}
