import { describe, expect, it } from "vitest";
import { matchRequirements, rankProperties, selectVerificationCandidates } from "@/domain/matching";
import { bandFor } from "@/domain/scoring";
import type {
  PropertyListing,
  PropertySearchRequirement,
  VerificationScore,
} from "@/domain/types";

const requirement: PropertySearchRequirement = {
  location: "Lekki",
  bedrooms: 3,
  maxRent: 8_000_000,
  currency: "EUR",
  rentPeriod: "yearly",
  amenities: ["parking", "prepaid meter"],
  additionalRequirements: [],
};

function makeListing(overrides: Partial<PropertyListing> = {}): PropertyListing {
  return {
    id: "p" + Math.random().toString(36).slice(2, 8),
    title: "3 Bedroom Apartment",
    description: "",
    location: "Lekki Phase 1, Lagos",
    area: "Lekki Phase 1",
    propertyType: "apartment",
    bedrooms: 3,
    bathrooms: 3,
    rent: 7_500_000,
    currency: "EUR",
    rentPeriod: "yearly",
    amenities: ["Parking", "Prepaid meter", "Security"],
    agentPhone: "+2347000000001",
    verificationStatus: "unverified",
    ...overrides,
  };
}

function score(value: number): VerificationScore {
  return { score: value, band: bandFor(value), components: [], highlights: [], warnings: [] };
}

describe("matchRequirements", () => {
  it("scores an exact match near the top", () => {
    const match = matchRequirements(makeListing(), requirement);
    expect(match.score).toBeGreaterThanOrEqual(95);
    expect(match.misses).toHaveLength(0);
  });

  it("penalises a listing outside budget but does not discard it", () => {
    const match = matchRequirements(makeListing({ rent: 9_500_000 }), requirement);
    expect(match.score).toBeLessThan(95);
    expect(match.score).toBeGreaterThan(0);
    expect(match.misses.join(" ")).toMatch(/budget/i);
  });

  it("penalises a wrong bedroom count", () => {
    const two = matchRequirements(makeListing({ bedrooms: 2 }), requirement);
    const five = matchRequirements(makeListing({ bedrooms: 5 }), requirement);
    expect(two.score).toBeLessThan(95);
    expect(five.score).toBeLessThan(two.score);
  });

  it("notes amenities the listing does not mention", () => {
    const match = matchRequirements(makeListing({ amenities: ["Security"] }), requirement);
    expect(match.misses.join(" ")).toMatch(/parking/i);
    expect(match.misses.join(" ")).toMatch(/prepaid/i);
  });
});

describe("rankProperties", () => {
  it("ranks a verified property above an unverified better match", () => {
    const verified = makeListing({ id: "verified", verificationStatus: "verified" });
    const unverified = makeListing({ id: "unverified", rent: 6_000_000 });

    const ranked = rankProperties([
      {
        listing: verified,
        match: { score: 94, reasons: [], misses: [] },
        verification: score(92),
      },
      {
        listing: unverified,
        // A better paper match, but nobody has checked it.
        match: { score: 96, reasons: [], misses: [] },
      },
    ]);

    expect(ranked[0]?.listing.id).toBe("verified");
    expect(ranked[1]?.listing.id).toBe("unverified");
  });

  it("orders two verified properties by their combined evidence", () => {
    const strong = makeListing({ id: "strong", verificationStatus: "verified" });
    const weak = makeListing({ id: "weak", verificationStatus: "verified" });

    const ranked = rankProperties([
      { listing: weak, match: { score: 91, reasons: [], misses: [] }, verification: score(78) },
      { listing: strong, match: { score: 94, reasons: [], misses: [] }, verification: score(92) },
    ]);

    expect(ranked[0]?.listing.id).toBe("strong");
  });

  it("sinks a confirmed-unavailable property to the bottom", () => {
    const gone = makeListing({ id: "gone", verificationStatus: "unavailable" });
    const ordinary = makeListing({ id: "ordinary" });

    const ranked = rankProperties([
      { listing: gone, match: { score: 99, reasons: [], misses: [] }, verification: score(30) },
      { listing: ordinary, match: { score: 60, reasons: [], misses: [] } },
    ]);

    expect(ranked.at(-1)?.listing.id).toBe("gone");
  });

  it("demotes a disputed property below a cleanly verified one at the same score", () => {
    const disputed = makeListing({ id: "disputed", verificationStatus: "disputed" });
    const clean = makeListing({ id: "clean", verificationStatus: "verified" });

    const ranked = rankProperties([
      { listing: disputed, match: { score: 90, reasons: [], misses: [] }, verification: score(80) },
      { listing: clean, match: { score: 90, reasons: [], misses: [] }, verification: score(80) },
    ]);

    expect(ranked[0]?.listing.id).toBe("clean");
  });
});

describe("selectVerificationCandidates", () => {
  it("only selects strong matches that have a contact number", () => {
    const ranked = rankProperties([
      { listing: makeListing({ id: "good" }), match: { score: 90, reasons: [], misses: [] } },
      { listing: makeListing({ id: "weak" }), match: { score: 20, reasons: [], misses: [] } },
      {
        listing: makeListing({ id: "nophone", agentPhone: undefined }),
        match: { score: 95, reasons: [], misses: [] },
      },
    ]);

    const candidates = selectVerificationCandidates(ranked).map((c) => c.listing.id);
    expect(candidates).toContain("good");
    expect(candidates).not.toContain("weak");
    expect(candidates).not.toContain("nophone");
  });

  it("caps the number of calls it will place", () => {
    const entries = Array.from({ length: 12 }, (_, index) => ({
      listing: makeListing({ id: "p" + index }),
      match: { score: 90, reasons: [], misses: [] },
    }));
    expect(selectVerificationCandidates(rankProperties(entries))).toHaveLength(5);
  });
});
