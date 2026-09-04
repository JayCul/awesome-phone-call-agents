import { describe, expect, it } from "vitest";
import { detectDiscrepancies, hasHighSeverity, toAnnual } from "@/domain/discrepancy";
import { formatMoney } from "@/domain/money";
import type { PropertyListing } from "@/domain/types";

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

describe("toAnnual", () => {
  it("normalises monthly rent to a yearly basis", () => {
    expect(toAnnual(500_000, "monthly")).toBe(6_000_000);
    expect(toAnnual(6_000_000, "yearly")).toBe(6_000_000);
  });
});

describe("formatMoney", () => {
  it("compacts millions, where compaction helps", () => {
    expect(formatMoney(7_500_000, "NGN")).toBe("₦7.5M");
    expect(formatMoney(9_000_000, "NGN")).toBe("₦9M");
  });

  it("writes smaller figures out in full, across currencies", () => {
    // Compacting a European monthly rent to "€1.4k" loses precision renters
    // care about, so figures below a million are never compacted.
    expect(formatMoney(1_450, "EUR")).toBe("€1,450");
    expect(formatMoney(2_400, "GBP")).toBe("£2,400");
    expect(formatMoney(2_150, "USD")).toBe("$2,150");
  });
});

describe("detectDiscrepancies", () => {
  it("finds a price mismatch when the agent quotes more", () => {
    const discrepancies = detectDiscrepancies(listing, {
      available: true,
      currentRent: 9_000_000,
      rentPeriod: "yearly",
      bedrooms: 3,
      parkingAvailable: true,
      electricityType: "prepaid meter",
      securityAvailable: true,
    });

    const price = discrepancies.find((d) => d.field === "rent");
    expect(price).toBeDefined();
    expect(price?.severity).toBe("high");
    expect(price?.listedValue).toBe("₦7.5M/year");
    expect(price?.verifiedValue).toBe("₦9M/year");
    expect(hasHighSeverity(discrepancies)).toBe(true);
  });

  it("finds an amenity mismatch when an advertised amenity is denied", () => {
    const discrepancies = detectDiscrepancies(listing, {
      available: true,
      currentRent: 7_500_000,
      rentPeriod: "yearly",
      bedrooms: 3,
      parkingAvailable: false,
      electricityType: "prepaid meter",
      securityAvailable: true,
    });

    const parking = discrepancies.find((d) => d.field === "amenity:parking");
    expect(parking).toBeDefined();
    expect(parking?.severity).toBe("high");
    expect(parking?.verifiedValue).toContain("not available");
  });

  it("reports unavailability as a high-severity discrepancy", () => {
    const discrepancies = detectDiscrepancies(listing, { available: false });
    expect(discrepancies[0]?.field).toBe("availability");
    expect(discrepancies[0]?.severity).toBe("high");
  });

  it("treats a rounding-level price difference as no mismatch", () => {
    const discrepancies = detectDiscrepancies(listing, {
      available: true,
      currentRent: 7_550_000,
      rentPeriod: "yearly",
    });
    expect(discrepancies.find((d) => d.field === "rent")).toBeUndefined();
  });

  it("does not invent a discrepancy from an unanswered question", () => {
    // Parking was never established: undefined, not false.
    const discrepancies = detectDiscrepancies(listing, {
      available: true,
      currentRent: 7_500_000,
      rentPeriod: "yearly",
      bedrooms: 3,
    });
    expect(discrepancies).toHaveLength(0);
  });

  it("flags a bedroom count that does not match", () => {
    const discrepancies = detectDiscrepancies(listing, {
      available: true,
      bedrooms: 2,
    });
    const bedrooms = discrepancies.find((d) => d.field === "bedrooms");
    expect(bedrooms).toBeDefined();
    expect(bedrooms?.severity).toBe("medium");
  });

  it("compares across rent periods", () => {
    const monthlyListing: PropertyListing = { ...listing, rent: 625_000, rentPeriod: "monthly" };
    // 625k/month is 7.5M/year, so a 7.5M/year quote is consistent.
    const discrepancies = detectDiscrepancies(monthlyListing, {
      available: true,
      currentRent: 7_500_000,
      rentPeriod: "yearly",
    });
    expect(discrepancies.find((d) => d.field === "rent")).toBeUndefined();
    // The period itself still differs and is worth surfacing.
    expect(discrepancies.find((d) => d.field === "rentPeriod")).toBeDefined();
  });
});
