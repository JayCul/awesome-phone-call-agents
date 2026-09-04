import "server-only";

import type { Property } from "@prisma/client";
import { prisma } from "../db";
import { toAnnual } from "@/domain/discrepancy";
import { asCurrency } from "@/domain/money";
import type {
  PropertyListing,
  PropertySearchRequirement,
  VerificationStatus,
} from "@/domain/types";
import type { PropertySearchProvider } from "./provider";

/**
 * Seeded listing provider.
 *
 * Queries the local corpus with deliberately loose filters: the ranking layer
 * decides what is a good match, so the provider's job is recall, not
 * precision. A property just outside budget is still worth showing with an
 * honest "over budget" note.
 */
export class MockPropertySearchProvider implements PropertySearchProvider {
  readonly name = "seeded-demo-corpus";

  async search(requirements: PropertySearchRequirement): Promise<PropertyListing[]> {
    const rows = await prisma.property.findMany({ orderBy: { rent: "asc" } });
    return rows.filter((row) => this.isPlausible(row, requirements)).map(toListing);
  }

  /**
   * Wide net: right city or area, bedroom count within one of the request,
   * and rent within 60% of the stated ceiling.
   */
  private isPlausible(row: Property, requirements: PropertySearchRequirement): boolean {
    const wanted = requirements.location.trim().toLowerCase();
    if (wanted) {
      const haystack = (row.area + " " + row.location).toLowerCase();
      const tokens = wanted.split(/[\s,]+/).filter((token) => token.length > 2);
      const locationHit =
        haystack.includes(wanted) || tokens.some((token) => haystack.includes(token));
      if (!locationHit) return false;
    }

    if (requirements.bedrooms !== undefined) {
      if (Math.abs(row.bedrooms - requirements.bedrooms) > 1) return false;
    }

    if (requirements.maxRent !== undefined) {
      const ceiling = toAnnual(requirements.maxRent, requirements.rentPeriod) * 1.6;
      if (toAnnual(row.rent, asRentPeriod(row.rentPeriod)) > ceiling) return false;
    }

    if (requirements.minRent !== undefined) {
      const floor = toAnnual(requirements.minRent, requirements.rentPeriod) * 0.5;
      if (toAnnual(row.rent, asRentPeriod(row.rentPeriod)) < floor) return false;
    }

    return true;
  }
}

function asRentPeriod(value: string): "monthly" | "yearly" {
  return value === "monthly" ? "monthly" : "yearly";
}

function asVerificationStatus(value: string): VerificationStatus {
  const allowed: VerificationStatus[] = [
    "unverified",
    "pending",
    "in_progress",
    "verified",
    "disputed",
    "unavailable",
    "failed",
  ];
  return allowed.includes(value as VerificationStatus)
    ? (value as VerificationStatus)
    : "unverified";
}

/** Parse a JSON string column, tolerating corruption rather than throwing. */
export function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function toListing(row: Property): PropertyListing {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    area: row.area,
    country: row.country ?? undefined,
    propertyType: row.propertyType,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms ?? undefined,
    rent: row.rent,
    currency: asCurrency(row.currency),
    rentPeriod: asRentPeriod(row.rentPeriod),
    amenities: parseStringArray(row.amenities),
    imageUrl: row.imageUrl ?? undefined,
    sourceUrl: row.sourceUrl ?? undefined,
    listedAt: row.listedAt ?? undefined,
    agentName: row.agentName ?? undefined,
    agentPhone: row.agentPhone ?? undefined,
    verificationStatus: asVerificationStatus(row.verificationStatus),
    verificationScore: row.verificationScore ?? undefined,
  };
}

export { asRentPeriod, asVerificationStatus };
