import { canonicalizeAmenities, amenityLabel, verifiedAmenityValue } from "./amenities";
import { toAnnual } from "./discrepancy";
import { formatMoney } from "./money";
import type {
  PropertyListing,
  PropertySearchRequirement,
  PropertyVerification,
  ScoreComponent,
  VerificationScore,
} from "./types";

/**
 * Transparent verification scoring.
 *
 * Every point is attributable to a named component, so the UI can explain the
 * number rather than asking the user to trust it. Weights are fixed and sum
 * to 100.
 */
export const SCORE_WEIGHTS = {
  availability: 30,
  price: 20,
  details: 15,
  amenities: 20,
  fees: 10,
  contact: 5,
} as const;

export function bandFor(score: number): VerificationScore["band"] {
  if (score >= 90) return "Highly verified";
  if (score >= 75) return "Verified";
  if (score >= 50) return "Needs review";
  return "Poor match";
}

/**
 * Score a completed verification against the listing and the user's needs.
 *
 * Unanswered questions score partial credit, never full credit: the point of
 * the product is that a confirmed fact outranks an assumed one.
 */
export function scoreVerification(
  listing: PropertyListing,
  verification: PropertyVerification,
  requirement: PropertySearchRequirement,
): VerificationScore {
  const components: ScoreComponent[] = [];
  const highlights: string[] = [];
  const warnings: string[] = [];

  const push = (component: ScoreComponent) => {
    components.push(component);
    if (component.status === "pass") highlights.push(component.detail);
    if (component.status === "warn" || component.status === "fail") warnings.push(component.detail);
  };

  // --- Availability (30) ----------------------------------------------------
  if (verification.available) {
    push({
      key: "availability",
      label: "Availability",
      weight: SCORE_WEIGHTS.availability,
      ratio: 1,
      earned: SCORE_WEIGHTS.availability,
      status: "pass",
      detail: "Property confirmed available",
    });
  } else {
    push({
      key: "availability",
      label: "Availability",
      weight: SCORE_WEIGHTS.availability,
      ratio: 0,
      earned: 0,
      status: "fail",
      detail: "Property is no longer available",
    });
  }

  // --- Price accuracy (20) --------------------------------------------------
  if (verification.currentRent !== undefined && verification.currentRent > 0) {
    const listedAnnual = toAnnual(listing.rent, listing.rentPeriod);
    const verifiedAnnual = toAnnual(
      verification.currentRent,
      verification.rentPeriod ?? listing.rentPeriod,
    );
    const relative =
      listedAnnual === 0 ? 1 : Math.abs(verifiedAnnual - listedAnnual) / listedAnnual;

    // An exact match scores full marks; the score decays to zero at a 25% gap.
    const ratio = relative <= 0.02 ? 1 : Math.max(0, 1 - relative / 0.25);
    const status = ratio >= 0.95 ? "pass" : ratio > 0 ? "warn" : "fail";
    push({
      key: "price",
      label: "Price accuracy",
      weight: SCORE_WEIGHTS.price,
      ratio,
      earned: round2(SCORE_WEIGHTS.price * ratio),
      status,
      detail:
        status === "pass"
          ? "Rent confirmed at " + formatMoney(verifiedAnnual, listing.currency) + "/year"
          : "Rent quoted at " +
            formatMoney(verifiedAnnual, listing.currency) +
            "/year, listing says " +
            formatMoney(listedAnnual, listing.currency) +
            "/year",
    });
  } else {
    push({
      key: "price",
      label: "Price accuracy",
      weight: SCORE_WEIGHTS.price,
      ratio: 0.3,
      earned: round2(SCORE_WEIGHTS.price * 0.3),
      status: "unknown",
      detail: "Rent was not confirmed on the call",
    });
  }

  // --- Property details (15) ------------------------------------------------
  const detailChecks: Array<{ ok: boolean | undefined; label: string }> = [
    {
      ok:
        verification.bedrooms === undefined
          ? undefined
          : verification.bedrooms === listing.bedrooms,
      label: listing.bedrooms + " bedrooms",
    },
    {
      ok:
        verification.bathrooms === undefined || listing.bathrooms === undefined
          ? undefined
          : verification.bathrooms === listing.bathrooms,
      label: (listing.bathrooms ?? 0) + " bathrooms",
    },
  ];
  const answered = detailChecks.filter((c) => c.ok !== undefined);
  const detailRatio =
    answered.length === 0 ? 0.3 : answered.filter((c) => c.ok === true).length / answered.length;
  const confirmedDetails = detailChecks.filter((c) => c.ok === true).map((c) => c.label);
  push({
    key: "details",
    label: "Property details",
    weight: SCORE_WEIGHTS.details,
    ratio: detailRatio,
    earned: round2(SCORE_WEIGHTS.details * detailRatio),
    status:
      answered.length === 0
        ? "unknown"
        : detailRatio === 1
          ? "pass"
          : detailRatio > 0
            ? "warn"
            : "fail",
    detail:
      answered.length === 0
        ? "Property details were not confirmed"
        : detailRatio === 1
          ? "Confirmed " + confirmedDetails.join(" and ")
          : "Some property details do not match the listing",
  });

  // --- Required amenities (20) ---------------------------------------------
  const requiredAmenities = canonicalizeAmenities(requirement.amenities);
  if (requiredAmenities.length === 0) {
    push({
      key: "amenities",
      label: "Required amenities",
      weight: SCORE_WEIGHTS.amenities,
      ratio: 1,
      earned: SCORE_WEIGHTS.amenities,
      status: "pass",
      detail: "No specific amenities required",
    });
  } else {
    let earnedRatio = 0;
    const confirmed: string[] = [];
    const denied: string[] = [];
    const unknown: string[] = [];

    for (const key of requiredAmenities) {
      const value = verifiedAmenityValue(key, verification);
      if (value === true) {
        earnedRatio += 1;
        confirmed.push(amenityLabel(key));
      } else if (value === false) {
        denied.push(amenityLabel(key));
      } else {
        // Not asked, or asked and not answered: half credit if the listing
        // claims it, so an unverified claim never outscores a confirmed one.
        const listed = canonicalizeAmenities(listing.amenities).includes(key);
        earnedRatio += listed ? 0.5 : 0;
        unknown.push(amenityLabel(key));
      }
    }

    const ratio = earnedRatio / requiredAmenities.length;
    push({
      key: "amenities",
      label: "Required amenities",
      weight: SCORE_WEIGHTS.amenities,
      ratio,
      earned: round2(SCORE_WEIGHTS.amenities * ratio),
      status: denied.length > 0 ? "fail" : ratio === 1 ? "pass" : "warn",
      detail:
        denied.length > 0
          ? denied.join(", ") + " not available"
          : ratio === 1
            ? "Confirmed " + confirmed.join(", ")
            : "Confirmed " +
              (confirmed.join(", ") || "none") +
              "; unconfirmed: " +
              unknown.join(", "),
    });
  }

  // --- Additional fees (10) -------------------------------------------------
  const feeFields: Array<[string, number | undefined]> = [
    ["Service charge", verification.serviceCharge],
    ["Agency fee", verification.agencyFee],
    ["Legal fee", verification.legalFee],
    ["Caution fee", verification.cautionFee],
  ];
  const disclosed = feeFields.filter(([, value]) => value !== undefined);
  const feeRatio = disclosed.length / feeFields.length;
  const missingFees = feeFields
    .filter(([, value]) => value === undefined)
    .map(([label]) => label.toLowerCase());
  push({
    key: "fees",
    label: "Additional fees",
    weight: SCORE_WEIGHTS.fees,
    ratio: feeRatio,
    earned: round2(SCORE_WEIGHTS.fees * feeRatio),
    status: feeRatio === 1 ? "pass" : feeRatio > 0 ? "warn" : "unknown",
    detail:
      feeRatio === 1
        ? "All upfront fees disclosed"
        : feeRatio > 0
          ? missingFees.join(", ") + " not confirmed"
          : "No fee breakdown given",
  });

  // --- Contact confidence (5) -----------------------------------------------
  const contactRatio = clamp01(verification.contactConfidence ?? 0.6);
  push({
    key: "contact",
    label: "Contact confidence",
    weight: SCORE_WEIGHTS.contact,
    ratio: contactRatio,
    earned: round2(SCORE_WEIGHTS.contact * contactRatio),
    status: contactRatio >= 0.8 ? "pass" : contactRatio >= 0.5 ? "warn" : "fail",
    detail:
      contactRatio >= 0.8
        ? "Contact answered clearly and consistently"
        : "Some answers on the call were ambiguous",
  });

  // Discrepancies are penalised on top of the component score, because an
  // active contradiction is worse than a gap in knowledge.
  const penalty = verification.discrepancies.reduce((total, d) => {
    if (d.field === "availability") return total; // already scored zero above
    if (d.severity === "high") return total + 8;
    if (d.severity === "medium") return total + 4;
    return total + 1;
  }, 0);

  // Floor rather than round: a score must never be rounded up into a higher
  // band. 100 is reserved for a verification where nothing at all was left
  // unconfirmed, which in practice a phone call rarely achieves.
  const raw = components.reduce((total, c) => total + c.earned, 0) - penalty;
  const score = Math.max(0, Math.min(100, Math.floor(raw)));

  for (const discrepancy of verification.discrepancies) {
    warnings.push(discrepancy.explanation);
  }

  return {
    score,
    band: bandFor(score),
    components,
    highlights: dedupe(highlights),
    warnings: dedupe(warnings),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
