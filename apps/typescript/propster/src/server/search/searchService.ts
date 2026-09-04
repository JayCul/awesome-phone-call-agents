import "server-only";

import type { ParsedRequirement } from "@/domain/schemas";
import { matchRequirements, rankProperties, selectVerificationCandidates } from "@/domain/matching";
import { prisma } from "../db";
import { ApiError } from "../http";
import { logger } from "../logger";
import { MockPropertySearchProvider } from "./mockProvider";
import type { PropertySearchProvider } from "./provider";

/**
 * Search orchestration: run the discovery provider, score every result against
 * the requirement, mark the strongest as verification candidates, and persist
 * the whole thing so the dashboard is a stable, shareable URL.
 */

let provider: PropertySearchProvider = new MockPropertySearchProvider();

/** Swap the discovery source. A live provider drops in here. */
export function setSearchProvider(next: PropertySearchProvider): void {
  provider = next;
}

export interface RunSearchResult {
  searchId: string;
  found: number;
  candidates: number;
}

export async function runSearch(
  requirement: ParsedRequirement,
  options: { rawQuery?: string; source: "model" | "rules" },
): Promise<RunSearchResult> {
  const listings = await provider.search(requirement);

  const search = await prisma.search.create({
    data: {
      rawQuery: options.rawQuery ?? null,
      extractionSource: options.source,
      location: requirement.location,
      propertyType: requirement.propertyType ?? null,
      bedrooms: requirement.bedrooms ?? null,
      bathrooms: requirement.bathrooms ?? null,
      minRent: requirement.minRent ?? null,
      maxRent: requirement.maxRent ?? null,
      currency: requirement.currency,
      rentPeriod: requirement.rentPeriod,
      moveInDate: requirement.moveInDate ?? null,
      amenities: JSON.stringify(requirement.amenities),
      additionalRequirements: JSON.stringify(requirement.additionalRequirements),
    },
  });

  if (listings.length === 0) {
    logger.info("search.no_results", { searchId: search.id, location: requirement.location });
    return { searchId: search.id, found: 0, candidates: 0 };
  }

  const scored = listings.map((listing) => ({
    listing,
    match: matchRequirements(listing, requirement),
  }));
  const ranked = rankProperties(scored);
  const candidateIds = new Set(selectVerificationCandidates(ranked).map((r) => r.listing.id));

  await prisma.searchCandidate.createMany({
    data: ranked.map((entry) => ({
      searchId: search.id,
      propertyId: entry.listing.id,
      matchScore: entry.match.score,
      matchNotes: JSON.stringify({ reasons: entry.match.reasons, misses: entry.match.misses }),
      isCandidate: candidateIds.has(entry.listing.id),
    })),
  });

  logger.info("search.completed", {
    searchId: search.id,
    provider: provider.name,
    found: ranked.length,
    candidates: candidateIds.size,
    source: options.source,
  });

  return { searchId: search.id, found: ranked.length, candidates: candidateIds.size };
}

export async function requireSearch(searchId: string) {
  const search = await prisma.search.findUnique({ where: { id: searchId } });
  if (!search) throw ApiError.notFound("That search no longer exists. Start a new one.");
  return search;
}
