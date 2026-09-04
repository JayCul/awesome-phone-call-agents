import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractWithRules } from "@/server/verification/transcriptExtractor";
import { toDomainVerification } from "@/server/verification/service";
import { detectDiscrepancies, hasHighSeverity } from "@/domain/discrepancy";
import { scoreVerification } from "@/domain/scoring";
import type { PropertyListing, PropertySearchRequirement, TranscriptTurn } from "@/domain/types";

/** End-to-end replay of the real call: transcript -> facts -> diff -> score. */
const TRANSCRIPT = JSON.parse(
  readFileSync("tests/fixtures/live-call-transcript.json", "utf8"),
) as TranscriptTurn[];

const LISTING: PropertyListing = {
  id: "p1", title: "3 Bedroom Apartment with BQ", description: "",
  location: "Lekki Phase 1, Lagos", area: "Lekki Phase 1", propertyType: "apartment",
  bedrooms: 3, bathrooms: 3, rent: 7_500_000, currency: "NGN", rentPeriod: "yearly",
  amenities: ["Parking", "Prepaid meter", "Security"], verificationStatus: "unverified",
};
const REQUIREMENT: PropertySearchRequirement = {
  location: "Lekki", bedrooms: 3, maxRent: 8_000_000, currency: "NGN", rentPeriod: "yearly",
  amenities: ["parking", "prepaid meter"], additionalRequirements: [],
};

describe("full pipeline replay of the live call", () => {
  const facts = extractWithRules(TRANSCRIPT);
  const verified = toDomainVerification(facts!, { completionConfidence: 0.9, summary: undefined });
  const discrepancies = detectDiscrepancies(LISTING, verified);
  const score = scoreVerification(LISTING, { ...verified, discrepancies }, REQUIREMENT);

  it("produces a score without throwing", () => {
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
  });

  it("confirms the prepaid meter the caller asked for", () => {
    const amenities = score.components.find((c) => c.key === "amenities");
    expect(amenities).toBeDefined();
    expect(verified.electricityType).toMatch(/prepaid/i);
  });

  it("does not fabricate a verified fee breakdown", () => {
    const fees = score.components.find((c) => c.key === "fees");
    expect(fees?.status).toBe("unknown");
  });

  it("prints the outcome for inspection", () => {
    console.log("  score        :", score.score, "(" + score.band + ")");
    console.log("  discrepancies:", discrepancies.length, hasHighSeverity(discrepancies) ? "(high severity present)" : "");
    for (const d of discrepancies) console.log("    -", d.field, ":", d.listedValue, "->", d.verifiedValue, "[" + d.severity + "]");
    expect(true).toBe(true);
  });
});
