import "server-only";

import { rankProperties } from "@/domain/matching";
import type {
  ActivityEvent,
  PropertyDiscrepancy,
  PropertyListing,
  PropertySearchRequirement,
  PropertyVerification,
  RequirementMatch,
  TranscriptTurn,
  VerificationScore,
  VerificationStatus,
} from "@/domain/types";
import { prisma } from "./db";
import { ApiError } from "./http";
import { asCurrency } from "@/domain/money";
import { toListing, parseStringArray } from "./search/mockProvider";

/**
 * Read models for the UI.
 *
 * Server components call these directly; API routes reuse them so the page and
 * the JSON API can never drift apart.
 */

export interface DashboardCard {
  listing: PropertyListing;
  match: RequirementMatch;
  verification?: VerificationScore;
  verificationId?: string;
  isCandidate: boolean;
  rankScore: number;
  discrepancies: PropertyDiscrepancy[];
}

export interface DashboardView {
  searchId: string;
  requirement: PropertySearchRequirement;
  rawQuery: string | null;
  extractionSource: string;
  createdAt: string;
  cards: DashboardCard[];
  counts: {
    found: number;
    candidates: number;
    verified: number;
    inProgress: number;
    unavailable: number;
    disputed: number;
  };
}

export async function getDashboard(searchId: string): Promise<DashboardView> {
  const search = await prisma.search.findUnique({
    where: { id: searchId },
    include: {
      candidates: {
        include: { property: true },
      },
    },
  });
  if (!search) throw ApiError.notFound("That search no longer exists. Start a new one.");

  const requirement = requirementOf(search);

  // Latest verification per property, scoped to this search.
  const verifications = await prisma.propertyVerification.findMany({
    where: { searchId },
    orderBy: { startedAt: "desc" },
    include: { discrepancies: true },
  });
  const latestByProperty = new Map<string, (typeof verifications)[number]>();
  for (const verification of verifications) {
    if (!latestByProperty.has(verification.propertyId)) {
      latestByProperty.set(verification.propertyId, verification);
    }
  }

  const entries = search.candidates.map((candidate) => {
    const listing = toListing(candidate.property);
    const verification = latestByProperty.get(candidate.propertyId);

    // The property row carries a global status; within a search, the status of
    // this search's own verification is what matters.
    const status: VerificationStatus = verification
      ? (verification.status as VerificationStatus)
      : "unverified";
    listing.verificationStatus = status;
    listing.verificationScore = verification?.score ?? undefined;

    const notes = parseMatchNotes(candidate.matchNotes);
    return {
      listing,
      match: { score: candidate.matchScore, reasons: notes.reasons, misses: notes.misses },
      verification: parseBreakdown(verification?.scoreBreakdown),
      verificationId: verification?.id,
      isCandidate: candidate.isCandidate,
      discrepancies: (verification?.discrepancies ?? []).map(toDiscrepancy),
    };
  });

  const ranked = rankProperties(
    entries.map((entry) => ({
      listing: entry.listing,
      match: entry.match,
      verification: entry.verification,
    })),
  );
  const orderById = new Map(ranked.map((entry, index) => [entry.listing.id, index]));

  const cards: DashboardCard[] = entries
    .map((entry) => ({
      ...entry,
      rankScore: ranked.find((r) => r.listing.id === entry.listing.id)?.rankScore ?? 0,
    }))
    .sort(
      (a, b) =>
        (orderById.get(a.listing.id) ?? 999) - (orderById.get(b.listing.id) ?? 999),
    );

  return {
    searchId: search.id,
    requirement,
    rawQuery: search.rawQuery,
    extractionSource: search.extractionSource,
    createdAt: search.createdAt.toISOString(),
    cards,
    counts: {
      found: cards.length,
      candidates: cards.filter((card) => card.isCandidate).length,
      verified: cards.filter((card) => card.listing.verificationStatus === "verified").length,
      inProgress: cards.filter(
        (card) =>
          card.listing.verificationStatus === "pending" ||
          card.listing.verificationStatus === "in_progress",
      ).length,
      unavailable: cards.filter((card) => card.listing.verificationStatus === "unavailable").length,
      disputed: cards.filter((card) => card.listing.verificationStatus === "disputed").length,
    },
  };
}

export interface CallDetail {
  provider: "call-e" | "mock";
  isLive: boolean;
  status: string;
  durationSeconds: number | null;
  startedAt: string;
  completedAt: string | null;
  summary: string | null;
  evidence: string[];
  transcript: TranscriptTurn[];
  taskCompleted: boolean | null;
  completionConfidence: number | null;
}

export interface PropertyDetailView {
  searchId: string | null;
  listing: PropertyListing;
  match?: RequirementMatch;
  requirement?: PropertySearchRequirement;
  status: VerificationStatus;
  verificationId?: string;
  verification?: PropertyVerification;
  breakdown?: VerificationScore;
  call?: CallDetail;
  events: ActivityEvent[];
  failureMessage?: string;
}

export async function getPropertyDetail(
  propertyId: string,
  searchId?: string,
): Promise<PropertyDetailView> {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) throw ApiError.notFound("That property does not exist.");

  const listing = toListing(property);

  const verification = await prisma.propertyVerification.findFirst({
    where: { propertyId, ...(searchId ? { searchId } : {}) },
    orderBy: { startedAt: "desc" },
    include: { discrepancies: true, callSession: true, events: { orderBy: { createdAt: "asc" } } },
  });

  let match: RequirementMatch | undefined;
  let requirement: PropertySearchRequirement | undefined;
  if (searchId) {
    const candidate = await prisma.searchCandidate.findUnique({
      where: { searchId_propertyId: { searchId, propertyId } },
    });
    if (candidate) {
      const notes = parseMatchNotes(candidate.matchNotes);
      match = { score: candidate.matchScore, reasons: notes.reasons, misses: notes.misses };
    }
    const search = await prisma.search.findUnique({ where: { id: searchId } });
    if (search) requirement = requirementOf(search);
  }

  const status: VerificationStatus = verification
    ? (verification.status as VerificationStatus)
    : "unverified";
  listing.verificationStatus = status;
  listing.verificationScore = verification?.score ?? undefined;

  const detail: PropertyDetailView = {
    searchId: searchId ?? null,
    listing,
    match,
    requirement,
    status,
    events: (verification?.events ?? []).map((event) => ({
      id: event.id,
      at: event.createdAt.toISOString(),
      level: event.level as ActivityEvent["level"],
      message: event.message,
      detail: event.detail ?? undefined,
    })),
  };

  if (!verification) return detail;

  detail.verificationId = verification.id;
  detail.failureMessage = verification.failureMessage ?? undefined;
  detail.breakdown = parseBreakdown(verification.scoreBreakdown);

  if (verification.verifiedAt) {
    detail.verification = {
      available: verification.available ?? false,
      currentRent: verification.currentRent ?? undefined,
      rentPeriod:
        verification.rentPeriod === "monthly"
          ? "monthly"
          : verification.rentPeriod === "yearly"
            ? "yearly"
            : undefined,
      bedrooms: verification.bedrooms ?? undefined,
      bathrooms: verification.bathrooms ?? undefined,
      serviceCharge: verification.serviceCharge ?? undefined,
      cautionFee: verification.cautionFee ?? undefined,
      agencyFee: verification.agencyFee ?? undefined,
      legalFee: verification.legalFee ?? undefined,
      electricityType: verification.electricityType ?? undefined,
      waterSupply: verification.waterSupply ?? undefined,
      parkingAvailable: verification.parkingAvailable ?? undefined,
      securityAvailable: verification.securityAvailable ?? undefined,
      generatorAvailable: verification.generatorAvailable ?? undefined,
      internetAvailable: verification.internetAvailable ?? undefined,
      airConditioning: verification.airConditioning ?? undefined,
      furnished: verification.furnished ?? undefined,
      petsAllowed: verification.petsAllowed ?? undefined,
      viewingAvailable: verification.viewingAvailable ?? undefined,
      viewingFee: verification.viewingFee ?? undefined,
      earliestMoveIn: verification.earliestMoveIn ?? undefined,
      agentNotes: verification.agentNotes ?? undefined,
      contactConfidence: verification.contactConfidence ?? undefined,
      discrepancies: verification.discrepancies.map(toDiscrepancy),
      verifiedAt: verification.verifiedAt.toISOString(),
    };
  }

  const session = verification.callSession;
  if (session) {
    detail.call = {
      provider: session.provider === "call-e" ? "call-e" : "mock",
      isLive: session.provider === "call-e",
      status: session.status,
      durationSeconds: session.durationSeconds,
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
      summary: session.summary,
      evidence: parseStringArray(session.evidence),
      transcript: parseTranscript(session.transcript),
      taskCompleted: session.taskCompleted,
      completionConfidence: session.completionConfidence,
    };
  }

  return detail;
}

// ---------------------------------------------------------------------------

type SearchRow = {
  location: string;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  minRent: number | null;
  maxRent: number | null;
  currency: string;
  rentPeriod: string;
  moveInDate: string | null;
  amenities: string;
  additionalRequirements: string;
};

export function requirementOf(search: SearchRow): PropertySearchRequirement {
  return {
    location: search.location,
    propertyType: search.propertyType ?? undefined,
    bedrooms: search.bedrooms ?? undefined,
    bathrooms: search.bathrooms ?? undefined,
    minRent: search.minRent ?? undefined,
    maxRent: search.maxRent ?? undefined,
    currency: asCurrency(search.currency),
    rentPeriod: search.rentPeriod === "monthly" ? "monthly" : "yearly",
    moveInDate: search.moveInDate ?? undefined,
    amenities: parseStringArray(search.amenities),
    additionalRequirements: parseStringArray(search.additionalRequirements),
  };
}

function toDiscrepancy(row: {
  field: string;
  listedValue: string | null;
  verifiedValue: string | null;
  severity: string;
  explanation: string;
}): PropertyDiscrepancy {
  return {
    field: row.field,
    listedValue: row.listedValue ?? undefined,
    verifiedValue: row.verifiedValue ?? undefined,
    severity: row.severity === "high" ? "high" : row.severity === "medium" ? "medium" : "low",
    explanation: row.explanation,
  };
}

function parseMatchNotes(value: string): { reasons: string[]; misses: string[] } {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      return {
        reasons: Array.isArray(record.reasons)
          ? record.reasons.filter((v): v is string => typeof v === "string")
          : [],
        misses: Array.isArray(record.misses)
          ? record.misses.filter((v): v is string => typeof v === "string")
          : [],
      };
    }
  } catch {
    // Corrupt notes should not take a dashboard down.
  }
  return { reasons: [], misses: [] };
}

function parseBreakdown(value: string | null | undefined): VerificationScore | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as VerificationScore;
  } catch {
    return undefined;
  }
}

function parseTranscript(value: string | null): TranscriptTurn[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((turn): turn is TranscriptTurn => {
      if (!turn || typeof turn !== "object") return false;
      const record = turn as Record<string, unknown>;
      return typeof record.text === "string" && typeof record.speaker === "string";
    });
  } catch {
    return [];
  }
}
