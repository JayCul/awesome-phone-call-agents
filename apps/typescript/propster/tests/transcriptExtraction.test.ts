import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  extractFactsFromTranscript,
  extractWithRules,
} from "@/server/verification/transcriptExtractor";
import type { PropertyListing, TranscriptTurn } from "@/domain/types";

/**
 * These run against a REAL transcript captured from a live CALL-E call to a
 * Nigerian mobile, saved verbatim in `tests/fixtures/live-call-transcript.json`.
 *
 * It is deliberately not a clean transcript. The speech recognition mangled
 * "prepaid meter" into "preparing me sir" and ran "five bedrooms, five
 * bathrooms" together as "58". Testing against idealised text would prove
 * nothing about how extraction behaves on a real phone line.
 */
const TRANSCRIPT = JSON.parse(
  readFileSync("tests/fixtures/live-call-transcript.json", "utf8"),
) as TranscriptTurn[];

const LISTING: PropertyListing = {
  id: "p1",
  title: "3 Bedroom Apartment with BQ",
  description: "",
  location: "Lekki Phase 1, Lagos",
  area: "Lekki Phase 1",
  propertyType: "apartment",
  bedrooms: 3,
  bathrooms: 3,
  rent: 7_500_000,
  currency: "NGN",
  rentPeriod: "yearly",
  amenities: ["Parking", "Prepaid meter", "Security", "Generator", "Borehole"],
  verificationStatus: "unverified",
};

describe("live transcript fixture", () => {
  it("is the real captured call, not a synthetic one", () => {
    expect(TRANSCRIPT.length).toBeGreaterThan(20);
    expect(TRANSCRIPT.some((t) => t.speaker === "agent")).toBe(true);
    expect(TRANSCRIPT.some((t) => t.speaker === "contact")).toBe(true);
    // The opening disclosure is a product requirement; assert it was actually said.
    expect(TRANSCRIPT[1]?.text.toLowerCase()).toContain("ai assistant");
  });
});

describe("extractWithRules (deterministic fallback)", () => {
  const facts = extractWithRules(TRANSCRIPT);

  it("produces a schema-valid result from noisy input", () => {
    expect(facts).not.toBeNull();
    expect(facts?.reached_contact).toBe(true);
  });

  it("recovers availability", () => {
    expect(facts?.property_available).toBe(true);
  });

  it("recovers the prepaid meter through the ASR mangling", () => {
    // The contact's actual audio was "there is a prepaid meter, sir"; the
    // recogniser produced "there is preparing me sir".
    expect(facts?.electricity_type).toMatch(/prepaid/i);
  });

  it("reads the rent the contact actually stated, not a stray digit", () => {
    // The contact said "Monthly. about 10 million naira". An earlier version
    // keyed off nearby words like "is" and picked up a "9" from unrelated
    // garbled speech, reporting ₦9M with full confidence.
    expect(facts?.current_rent).toBe(10_000_000);
    expect(facts?.rent_period).toBe("monthly");
  });

  it("ignores small numbers that are not sums of money", () => {
    const turns: TranscriptTurn[] = [
      { offsetSeconds: 0, speaker: "contact", text: "there are 3 bedrooms and 2 cars can park" },
    ];
    expect(extractWithRules(turns)?.current_rent ?? null).toBeNull();
  });

  it("never reports a fact the contact did not give", () => {
    // Pets and viewing fee were never discussed on this call.
    expect(facts?.pets_allowed ?? null).toBeNull();
    expect(facts?.viewing_fee ?? null).toBeNull();
  });

  it("returns null rather than inventing facts from an empty transcript", () => {
    expect(extractWithRules([])).toBeNull();
    expect(extractWithRules([{ offsetSeconds: 0, speaker: "agent", text: "Hello?" }])).toBeNull();
  });

  it("does not attribute the assistant's questions to the contact", () => {
    // The assistant asked about parking and bathrooms; the contact's answers
    // were garbled. Nothing should be claimed from the question alone.
    const questionsOnly: TranscriptTurn[] = TRANSCRIPT.filter((t) => t.speaker === "agent");
    expect(extractWithRules(questionsOnly)).toBeNull();
  });
});

/**
 * The Claude path costs a network round trip and real tokens, so it is opt-in:
 *
 *   LIVE_LLM=1 npm test
 *
 * `npm test` stays deterministic and offline. Everything above this line runs
 * always, including the fallback that keeps verification working when Claude
 * is unavailable.
 */
const liveLlm =
  process.env.LIVE_LLM === "1" &&
  Boolean(process.env.GROQ_API_KEY || process.env.ANTHROPIC_API_KEY);

describe.skipIf(!liveLlm)("extractFactsFromTranscript (live model, LIVE_LLM=1)", () => {
  it("reads the contact's answers out of a noisy real transcript", async () => {
    const result = await extractFactsFromTranscript(TRANSCRIPT, LISTING);

    expect(result).not.toBeNull();
    expect(result?.source).toBe("model");

    const facts = result!.facts;
    expect(facts.reached_contact).toBe(true);
    expect(facts.property_available).toBe(true);

    // The contact said "Monthly. about 10 million naira" against a listing
    // advertising ₦7.5M per YEAR. Capturing the period correctly is the whole
    // point: getting it wrong turns a 16x discrepancy into a rounding error.
    expect(facts.rent_period).toBe("monthly");
    expect(facts.current_rent).toBe(10_000_000);

    // The contact corrected themselves from an ambiguous "58" to
    // "5 bedrooms and five bathrooms". The correction must win.
    expect(facts.bedrooms).toBe(5);
    expect(facts.bathrooms).toBe(5);

    expect(facts.electricity_type).toMatch(/prepaid/i);
  });

  it("does not copy the listing's values into unanswered fields", async () => {
    const result = await extractFactsFromTranscript(TRANSCRIPT, LISTING);
    const facts = result!.facts;

    // The listing claims a caution fee and agency fee; neither was discussed.
    expect(facts.caution_fee ?? null).toBeNull();
    expect(facts.agency_fee ?? null).toBeNull();
    // Listing bedrooms are 3. The call said 5. It must not have been "corrected".
    expect(facts.bedrooms).not.toBe(LISTING.bedrooms);
  });
});
