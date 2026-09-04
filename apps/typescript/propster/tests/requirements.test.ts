import { describe, expect, it } from "vitest";
import {
  extractRequirementWithRules,
  parseMoney,
} from "@/server/requirements/ruleExtractor";

describe("parseMoney", () => {
  it("reads Nigerian rent notation", () => {
    expect(parseMoney("8 million")).toBe(8_000_000);
    expect(parseMoney("₦8m")).toBe(8_000_000);
    expect(parseMoney("N8,000,000")).toBe(8_000_000);
    expect(parseMoney("7.5m")).toBe(7_500_000);
    expect(parseMoney("800k")).toBe(800_000);
    expect(parseMoney("750,000")).toBe(750_000);
  });

  it("takes a bare number at face value rather than guessing millions", () => {
    // An earlier, Lagos-only version read "under 8" as eight million, because
    // that is what it meant in the one market the product supported. Globally
    // that guess is wrong far more often than it is right: "under 1800" in
    // Lisbon means 1800 euros. A magnitude word is now required to scale.
    expect(parseMoney("8")).toBe(8);
    expect(parseMoney("1800")).toBe(1800);
    expect(parseMoney("8 million")).toBe(8_000_000);
  });

  it("returns undefined when there is no number", () => {
    expect(parseMoney("somewhere nice")).toBeUndefined();
  });
});

describe("extractRequirementWithRules", () => {
  it("extracts the specification example", () => {
    const result = extractRequirementWithRules(
      "3 bedroom apartment in Lekki under 8 million with parking",
    );

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      location: "Lekki",
      propertyType: "apartment",
      bedrooms: 3,
      maxRent: 8_000_000,
      currency: "NGN",
      rentPeriod: "yearly",
    });
    expect(result?.amenities).toContain("parking");
  });

  it("handles the full demo query", () => {
    const result = extractRequirementWithRules(
      "I need a 3 bedroom apartment in Lekki under ₦8 million per year. I need parking, prepaid electricity and I want to move in this month.",
    );

    expect(result?.bedrooms).toBe(3);
    expect(result?.location).toBe("Lekki");
    expect(result?.maxRent).toBe(8_000_000);
    expect(result?.rentPeriod).toBe("yearly");
    expect(result?.amenities).toEqual(expect.arrayContaining(["parking", "prepaid meter"]));
    expect(result?.moveInDate).toBe("this month");
  });

  it("detects monthly rent when stated", () => {
    const result = extractRequirementWithRules(
      "2 bedroom flat in Yaba under 800k per month with internet",
    );
    expect(result?.rentPeriod).toBe("monthly");
    expect(result?.maxRent).toBe(800_000);
    expect(result?.amenities).toContain("internet");
  });

  it("reads a between-range budget", () => {
    const result = extractRequirementWithRules(
      "3 bedroom in Ikoyi between 15 million and 25 million a year",
    );
    expect(result?.minRent).toBe(15_000_000);
    expect(result?.maxRent).toBe(25_000_000);
  });

  it("prefers the most specific area name", () => {
    const result = extractRequirementWithRules("2 bedroom in Lekki Phase 1 under 6m");
    expect(result?.location).toBe("Lekki Phase 1");
  });

  it("follows the market for currency and rent period", () => {
    const lisbon = extractRequirementWithRules("2 bedroom in Lisbon under 1800 a month");
    expect(lisbon?.currency).toBe("EUR");
    expect(lisbon?.rentPeriod).toBe("monthly");

    // Dubai and Lagos quote a year; most other markets quote a month.
    const dubai = extractRequirementWithRules("3 bedroom in Dubai under 150000");
    expect(dubai?.currency).toBe("AED");
    expect(dubai?.rentPeriod).toBe("yearly");

    const lagos = extractRequirementWithRules("3 bedroom in Lekki under 8 million");
    expect(lagos?.currency).toBe("NGN");
    expect(lagos?.rentPeriod).toBe("yearly");

    const austin = extractRequirementWithRules("1 bed in Austin under 2300 a month");
    expect(austin?.currency).toBe("USD");
    expect(austin?.rentPeriod).toBe("monthly");
  });

  it("reads an explicit currency symbol over the market default", () => {
    // Someone searching Berlin in pounds means pounds.
    const result = extractRequirementWithRules("2 bed in Berlin under £1,500 a month");
    expect(result?.currency).toBe("GBP");
  });

  it("returns null when there is no recognisable location", () => {
    expect(extractRequirementWithRules("something cheap please")).toBeNull();
  });

  it("never invents a budget that was not stated", () => {
    const result = extractRequirementWithRules("3 bedroom apartment in Lekki with parking");
    expect(result?.maxRent).toBeUndefined();
    expect(result?.minRent).toBeUndefined();
  });

  it("captures worded bedroom counts", () => {
    const result = extractRequirementWithRules("three bedroom flat in Ajah");
    expect(result?.bedrooms).toBe(3);
  });
});
