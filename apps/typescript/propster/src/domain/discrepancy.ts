import { canonicalizeAmenities, amenityLabel, verifiedAmenityValue } from "./amenities";
import { formatMoney, type Currency } from "./money";
import type {
  PropertyDiscrepancy,
  PropertyListing,
  PropertyVerification,
} from "./types";

/**
 * Listing-versus-reality comparison. This is the heart of the product: the
 * listing is a claim, the call is evidence, and every place they disagree is
 * surfaced rather than smoothed over.
 */

/** Rent is quoted per month or per year; compare on a common basis. */
export function toAnnual(amount: number, period: "monthly" | "yearly"): number {
  return period === "monthly" ? amount * 12 : amount;
}

/** Rent gaps under this fraction are treated as rounding, not a mismatch. */
const RENT_TOLERANCE = 0.02;

export interface VerificationFacts {
  available: boolean;
  currentRent?: number;
  currency?: Currency;
  rentPeriod?: "monthly" | "yearly";
  bedrooms?: number;
  bathrooms?: number;
  parkingAvailable?: boolean;
  securityAvailable?: boolean;
  generatorAvailable?: boolean;
  internetAvailable?: boolean;
  airConditioning?: boolean;
  furnished?: boolean;
  petsAllowed?: boolean;
  electricityType?: string;
  waterSupply?: string;
}

/**
 * Compare the advertised listing against the facts recovered from the call.
 *
 * Only fields the call actually established are compared. A question the
 * contact declined to answer produces no discrepancy — silence is not a
 * contradiction — but it also earns no credit in the score.
 */
export function detectDiscrepancies(
  listing: PropertyListing,
  facts: VerificationFacts,
): PropertyDiscrepancy[] {
  const discrepancies: PropertyDiscrepancy[] = [];
  // Rent is only ever compared within one currency; see domain/money.ts.
  const money = (amount: number) => formatMoney(amount, listing.currency);

  if (!facts.available) {
    discrepancies.push({
      field: "availability",
      listedValue: "Advertised as available",
      verifiedValue: "Not available",
      severity: "high",
      explanation: "The contact said this property is no longer on the market.",
    });
  }

  // --- Rent -----------------------------------------------------------------
  if (facts.currentRent !== undefined && facts.currentRent > 0) {
    const verifiedPeriod = facts.rentPeriod ?? listing.rentPeriod;
    const listedAnnual = toAnnual(listing.rent, listing.rentPeriod);
    const verifiedAnnual = toAnnual(facts.currentRent, verifiedPeriod);
    const delta = verifiedAnnual - listedAnnual;
    const relative = listedAnnual === 0 ? 1 : Math.abs(delta) / listedAnnual;

    if (relative > RENT_TOLERANCE) {
      const direction = delta > 0 ? "higher" : "lower";
      const severity = relative > 0.15 ? "high" : relative > 0.05 ? "medium" : "low";
      discrepancies.push({
        field: "rent",
        listedValue: money(listedAnnual) + "/year",
        verifiedValue: money(verifiedAnnual) + "/year",
        severity,
        explanation:
          "Confirmed rent is " + Math.round(relative * 100) + "% " + direction +
          " than the listing (" + money(Math.abs(delta)) + "/year difference).",
      });
    }

    if (facts.rentPeriod && facts.rentPeriod !== listing.rentPeriod) {
      discrepancies.push({
        field: "rentPeriod",
        listedValue: `Quoted ${listing.rentPeriod}`,
        verifiedValue: `Quoted ${facts.rentPeriod}`,
        severity: "medium",
        explanation: "The listing and the agent quote rent over different periods.",
      });
    }
  }

  // --- Property details -----------------------------------------------------
  if (facts.bedrooms !== undefined && facts.bedrooms !== listing.bedrooms) {
    discrepancies.push({
      field: "bedrooms",
      listedValue: `${listing.bedrooms} bedrooms`,
      verifiedValue: `${facts.bedrooms} bedrooms`,
      severity: Math.abs(facts.bedrooms - listing.bedrooms) > 1 ? "high" : "medium",
      explanation: "The bedroom count on the call does not match the listing.",
    });
  }

  if (
    facts.bathrooms !== undefined &&
    listing.bathrooms !== undefined &&
    facts.bathrooms !== listing.bathrooms
  ) {
    discrepancies.push({
      field: "bathrooms",
      listedValue: `${listing.bathrooms} bathrooms`,
      verifiedValue: `${facts.bathrooms} bathrooms`,
      severity: "low",
      explanation: "The bathroom count on the call does not match the listing.",
    });
  }

  // --- Amenities ------------------------------------------------------------
  for (const key of canonicalizeAmenities(listing.amenities)) {
    const verified = verifiedAmenityValue(key, facts);
    if (verified === false) {
      discrepancies.push({
        field: `amenity:${key}`,
        listedValue: `${amenityLabel(key)} advertised`,
        verifiedValue: `${amenityLabel(key)} not available`,
        severity: "high",
        explanation: `The listing advertises ${amenityLabel(key).toLowerCase()} but the contact said it is not available.`,
      });
    }
  }

  return discrepancies;
}

/** A verification with a high-severity discrepancy is "disputed", not "verified". */
export function hasHighSeverity(discrepancies: readonly PropertyDiscrepancy[]): boolean {
  return discrepancies.some((d) => d.severity === "high");
}

export function summariseDiscrepancy(discrepancy: PropertyDiscrepancy): string {
  if (discrepancy.field === "rent") return "Price mismatch";
  if (discrepancy.field.startsWith("amenity:")) return "Amenity mismatch";
  if (discrepancy.field === "availability") return "No longer available";
  if (discrepancy.field === "bedrooms") return "Bedroom count mismatch";
  return "Listing mismatch";
}

export type { PropertyVerification };
