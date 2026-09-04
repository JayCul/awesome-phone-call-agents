import { canonicalizeAmenities, amenityLabel } from "./amenities";
import { toAnnual } from "./discrepancy";
import { formatMoney } from "./money";
import type {
  PropertyListing,
  PropertySearchRequirement,
  RankedProperty,
  RequirementMatch,
  VerificationScore,
} from "./types";

/**
 * Requirement matching and candidate ranking.
 *
 * `matchRequirements` answers "does this listing look like what the user
 * asked for", using only the advertised data. `rankProperties` then decides
 * running order, where a verified property outranks an unverified one even
 * when the unverified one looks like a slightly better match on paper.
 */

const MATCH_WEIGHTS = {
  location: 25,
  bedrooms: 25,
  budget: 25,
  amenities: 20,
  propertyType: 5,
} as const;

export function matchRequirements(
  listing: PropertyListing,
  requirement: PropertySearchRequirement,
): RequirementMatch {
  const reasons: string[] = [];
  const misses: string[] = [];
  let earned = 0;

  // --- Location -------------------------------------------------------------
  const wanted = requirement.location.toLowerCase().trim();
  const haystack = (listing.area + " " + listing.location).toLowerCase();
  if (wanted && haystack.includes(wanted)) {
    earned += MATCH_WEIGHTS.location;
    reasons.push("In " + listing.area);
  } else if (wanted && wanted.split(/[\s,]+/).some((token) => token.length > 2 && haystack.includes(token))) {
    // "Lekki, Lagos" should still partially match a listing in "Lekki Phase 1".
    earned += MATCH_WEIGHTS.location * 0.6;
    reasons.push("Near " + listing.area);
  } else {
    misses.push("Outside " + requirement.location);
  }

  // --- Bedrooms -------------------------------------------------------------
  if (requirement.bedrooms === undefined) {
    earned += MATCH_WEIGHTS.bedrooms;
  } else if (listing.bedrooms === requirement.bedrooms) {
    earned += MATCH_WEIGHTS.bedrooms;
    reasons.push(listing.bedrooms + " bedrooms");
  } else if (Math.abs(listing.bedrooms - requirement.bedrooms) === 1) {
    earned += MATCH_WEIGHTS.bedrooms * 0.5;
    misses.push(listing.bedrooms + " bedrooms, you asked for " + requirement.bedrooms);
  } else {
    misses.push(listing.bedrooms + " bedrooms, you asked for " + requirement.bedrooms);
  }

  // --- Budget ---------------------------------------------------------------
  const annual = toAnnual(listing.rent, listing.rentPeriod);
  const maxAnnual =
    requirement.maxRent === undefined
      ? undefined
      : toAnnual(requirement.maxRent, requirement.rentPeriod);
  const minAnnual =
    requirement.minRent === undefined
      ? undefined
      : toAnnual(requirement.minRent, requirement.rentPeriod);

  if (maxAnnual === undefined && minAnnual === undefined) {
    earned += MATCH_WEIGHTS.budget;
  } else {
    const overBudget = maxAnnual !== undefined && annual > maxAnnual;
    const underFloor = minAnnual !== undefined && annual < minAnnual;
    if (!overBudget && !underFloor) {
      earned += MATCH_WEIGHTS.budget;
      reasons.push("Within budget at " + formatMoney(annual, listing.currency) + "/year");
    } else if (overBudget && maxAnnual !== undefined) {
      const overshoot = (annual - maxAnnual) / maxAnnual;
      // A 10% overshoot still scores; beyond 40% it is out of the running.
      const ratio = Math.max(0, 1 - overshoot / 0.4);
      earned += MATCH_WEIGHTS.budget * ratio;
      misses.push(
        formatMoney(annual, listing.currency) +
          "/year is over your " +
          formatMoney(maxAnnual, listing.currency) +
          " budget",
      );
    } else {
      earned += MATCH_WEIGHTS.budget * 0.5;
      misses.push("Below your stated minimum rent");
    }
  }

  // --- Amenities ------------------------------------------------------------
  const required = canonicalizeAmenities(requirement.amenities);
  const listed = new Set(canonicalizeAmenities(listing.amenities));
  if (required.length === 0) {
    earned += MATCH_WEIGHTS.amenities;
  } else {
    const present = required.filter((key) => listed.has(key));
    earned += (MATCH_WEIGHTS.amenities * present.length) / required.length;
    for (const key of present) reasons.push(amenityLabel(key) + " listed");
    for (const key of required.filter((k) => !listed.has(k))) {
      misses.push(amenityLabel(key) + " not mentioned in the listing");
    }
  }

  // --- Property type --------------------------------------------------------
  if (
    !requirement.propertyType ||
    listing.propertyType.toLowerCase().includes(requirement.propertyType.toLowerCase())
  ) {
    earned += MATCH_WEIGHTS.propertyType;
  } else {
    misses.push("Listed as a " + listing.propertyType);
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(earned))),
    reasons,
    misses,
  };
}

/**
 * Rank score blends requirement match with verification evidence.
 *
 * The verification term is weighted so that a verified property beats an
 * unverified one at equal-or-slightly-lower requirement match, and an
 * unavailable property sinks to the bottom regardless of how good it looked.
 */
export function rankScoreFor(
  listing: PropertyListing,
  match: RequirementMatch,
  verification: VerificationScore | undefined,
): number {
  if (listing.verificationStatus === "unavailable") {
    // Confirmed gone. Keep it visible for transparency, but never near the top.
    return match.score * 0.1;
  }

  const base = match.score * 0.6;

  if (verification === undefined) {
    // Unverified listings carry an evidence discount: the claim is unchecked.
    const pendingBonus =
      listing.verificationStatus === "pending" || listing.verificationStatus === "in_progress"
        ? 4
        : 0;
    return base + match.score * 0.4 * 0.55 + pendingBonus;
  }

  const evidence = verification.score * 0.4;
  const disputePenalty = listing.verificationStatus === "disputed" ? 6 : 0;
  const failedPenalty = listing.verificationStatus === "failed" ? 4 : 0;
  return base + evidence - disputePenalty - failedPenalty;
}

export function rankProperties(
  entries: Array<{
    listing: PropertyListing;
    match: RequirementMatch;
    verification?: VerificationScore;
  }>,
): RankedProperty[] {
  return entries
    .map((entry) => ({
      ...entry,
      rankScore: Math.round(rankScoreFor(entry.listing, entry.match, entry.verification) * 100) / 100,
    }))
    .sort((a, b) => {
      if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
      if (b.match.score !== a.match.score) return b.match.score - a.match.score;
      // Final tiebreak: cheaper first.
      return (
        toAnnual(a.listing.rent, a.listing.rentPeriod) -
        toAnnual(b.listing.rent, b.listing.rentPeriod)
      );
    });
}

/**
 * Which listings are worth spending a phone call on. Calls cost money and the
 * contact's time, so only strong candidates are dialled.
 */
export function selectVerificationCandidates(
  ranked: readonly RankedProperty[],
  limit = 5,
): RankedProperty[] {
  return ranked
    .filter((entry) => entry.match.score >= 55 && entry.listing.agentPhone)
    .slice(0, limit);
}
