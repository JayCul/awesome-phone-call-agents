import { describe, expect, it } from "vitest";
import { detectDiscrepancies } from "@/domain/discrepancy";
import { bandFor, scoreVerification, SCORE_WEIGHTS } from "@/domain/scoring";
import type {
  PropertyListing,
  PropertySearchRequirement,
  PropertyVerification,
} from "@/domain/types";

const listing: PropertyListing = {
  id: "p1",
  title: "3 Bedroom Apartment",
  description: "",
  location: "Lekki Phase 1, Lagos",
  area: "Lekki Phase 1",
  propertyType: "apartment",
  bedrooms: 3,
  bathrooms: 3,
  rent: 7_500_000,
  currency: "NGN",
  rentPeriod: "yearly",
  amenities: ["Parking", "Prepaid meter", "Security"],
  verificationStatus: "unverified",
};

const requirement: PropertySearchRequirement = {
  location: "Lekki",
  bedrooms: 3,
  maxRent: 8_000_000,
  currency: "NGN",
  rentPeriod: "yearly",
  amenities: ["parking", "prepaid meter"],
  additionalRequirements: [],
};

const fullyConfirmed: PropertyVerification = {
  available: true,
  currentRent: 7_500_000,
  rentPeriod: "yearly",
  bedrooms: 3,
  bathrooms: 3,
  serviceCharge: 500_000,
  agencyFee: 750_000,
  legalFee: 750_000,
  cautionFee: 200_000,
  electricityType: "prepaid meter",
  waterSupply: "borehole",
  parkingAvailable: true,
  securityAvailable: true,
  contactConfidence: 0.93,
  discrepancies: [],
  verifiedAt: new Date().toISOString(),
};

describe("bandFor", () => {
  it("maps scores onto the published bands", () => {
    expect(bandFor(95)).toBe("Highly verified");
    expect(bandFor(90)).toBe("Highly verified");
    expect(bandFor(89)).toBe("Verified");
    expect(bandFor(75)).toBe("Verified");
    expect(bandFor(74)).toBe("Needs review");
    expect(bandFor(50)).toBe("Needs review");
    expect(bandFor(49)).toBe("Poor match");
  });
});

describe("scoreVerification", () => {
  it("weights sum to 100", () => {
    const total = Object.values(SCORE_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBe(100);
  });

  it("scores a fully confirmed listing in the highly-verified band", () => {
    const result = scoreVerification(listing, fullyConfirmed, requirement);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.band).toBe("Highly verified");
    expect(result.warnings).toHaveLength(0);
  });

  it("is explainable: every component is attributable", () => {
    const result = scoreVerification(listing, fullyConfirmed, requirement);
    const keys = result.components.map((component) => component.key);
    expect(keys).toEqual([
      "availability",
      "price",
      "details",
      "amenities",
      "fees",
      "contact",
    ]);
    for (const component of result.components) {
      expect(component.earned).toBeLessThanOrEqual(component.weight);
      expect(component.detail.length).toBeGreaterThan(0);
    }
  });

  it("scores an unavailable property poorly regardless of everything else", () => {
    const verification: PropertyVerification = {
      ...fullyConfirmed,
      available: false,
      discrepancies: detectDiscrepancies(listing, { available: false }),
    };
    const result = scoreVerification(listing, verification, requirement);
    expect(result.score).toBeLessThan(75);
    expect(result.components.find((c) => c.key === "availability")?.earned).toBe(0);
  });

  it("penalises a price mismatch", () => {
    const facts = {
      available: true,
      currentRent: 9_000_000,
      rentPeriod: "yearly" as const,
      bedrooms: 3,
      bathrooms: 3,
      parkingAvailable: true,
      electricityType: "prepaid meter",
    };
    const verification: PropertyVerification = {
      ...fullyConfirmed,
      currentRent: 9_000_000,
      discrepancies: detectDiscrepancies(listing, facts),
    };
    const result = scoreVerification(listing, verification, requirement);
    const clean = scoreVerification(listing, fullyConfirmed, requirement);
    expect(result.score).toBeLessThan(clean.score);
    expect(result.warnings.join(" ")).toMatch(/rent/i);
  });

  it("penalises a denied required amenity", () => {
    const facts = {
      available: true,
      currentRent: 7_500_000,
      rentPeriod: "yearly" as const,
      bedrooms: 3,
      bathrooms: 3,
      parkingAvailable: false,
      electricityType: "prepaid meter",
    };
    const verification: PropertyVerification = {
      ...fullyConfirmed,
      parkingAvailable: false,
      discrepancies: detectDiscrepancies(listing, facts),
    };
    const result = scoreVerification(listing, verification, requirement);
    expect(result.score).toBeLessThan(85);
    expect(result.components.find((c) => c.key === "amenities")?.status).toBe("fail");
  });

  it("gives partial, not full, credit for unanswered questions", () => {
    const sparse: PropertyVerification = {
      available: true,
      contactConfidence: 0.6,
      discrepancies: [],
      verifiedAt: new Date().toISOString(),
    };
    const result = scoreVerification(listing, sparse, requirement);
    const complete = scoreVerification(listing, fullyConfirmed, requirement);
    expect(result.score).toBeLessThan(complete.score);
    expect(result.components.find((c) => c.key === "price")?.status).toBe("unknown");
    expect(result.components.find((c) => c.key === "fees")?.status).toBe("unknown");
  });
});
