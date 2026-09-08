import { describe, expect, it } from "vitest";
import { scoreVerification } from "@/domain/scoring";
import { detectDiscrepancies } from "@/domain/discrepancy";
import type {
  PropertyListing,
  PropertySearchRequirement,
  PropertyVerification,
} from "@/domain/types";

/**
 * Availability has three states, not two.
 *
 * `true` is a confirmation, `false` is a refusal, and undefined means the call
 * never established it. The first live CALL-E call in production collapsed the
 * third into the second: the contact said "I'm sorry, I can't help further",
 * the guard correctly reduced the model's invented `false` to null, and the
 * persistence layer then wrote `property_available === true`, turning the null
 * straight back into false. The property was reported unavailable, scored zero
 * for availability, and raised a high-severity discrepancy quoting a contact
 * who had said no such thing.
 */
const listing: PropertyListing = {
  id: "p1",
  title: "2 Bedroom Apartment",
  description: "",
  location: "Príncipe Real, Lisbon",
  area: "Príncipe Real",
  propertyType: "apartment",
  bedrooms: 2,
  bathrooms: 2,
  rent: 1650,
  currency: "EUR",
  rentPeriod: "monthly",
  amenities: [],
  agentName: "Agent",
  agentPhone: "+12763229632",
  listedAt: "2026-09-01",
  verificationStatus: "unverified",
};

const requirement: PropertySearchRequirement = {
  location: "Lisbon",
  currency: "EUR",
  rentPeriod: "monthly",
  amenities: [],
  additionalRequirements: [],
};

const base = { discrepancies: [] } as unknown as PropertyVerification;

const withAvailability = (available: boolean | undefined): PropertyVerification =>
  ({ ...base, available }) as PropertyVerification;

describe("an availability the call never established", () => {
  it("is not reported as a refusal", () => {
    expect(detectDiscrepancies(listing, withAvailability(undefined))).toHaveLength(0);
  });

  it("still reports a real refusal as a high-severity discrepancy", () => {
    const found = detectDiscrepancies(listing, withAvailability(false));
    expect(found).toHaveLength(1);
    expect(found[0]?.severity).toBe("high");
    expect(found[0]?.field).toBe("availability");
  });

  it("scores as unknown rather than as a failure", () => {
    const unknown = scoreVerification(listing, withAvailability(undefined), requirement);
    const component = unknown.components.find((c) => c.key === "availability");
    expect(component?.status).toBe("unknown");
    expect(component?.detail).toMatch(/not confirmed/i);
  });

  it("never claims the property is gone in the warnings", () => {
    const unknown = scoreVerification(listing, withAvailability(undefined), requirement);
    expect(unknown.warnings.join(" ")).not.toMatch(/no longer available|not available/i);
  });

  it("scores strictly between a refusal and a confirmation", () => {
    const confirmed = scoreVerification(listing, withAvailability(true), requirement).score;
    const unknown = scoreVerification(listing, withAvailability(undefined), requirement).score;
    const refused = scoreVerification(listing, withAvailability(false), requirement).score;

    expect(refused).toBeLessThan(unknown);
    expect(unknown).toBeLessThan(confirmed);
  });
});
