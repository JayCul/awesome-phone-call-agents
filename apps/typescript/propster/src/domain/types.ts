/**
 * Core domain vocabulary for Propster.
 *
 * These types are the contract between the search layer, the phone
 * verification layer and the UI. They deliberately contain no persistence or
 * transport concerns so that the scoring, matching and discrepancy logic can
 * be unit tested as pure functions.
 */

import type { Currency } from "./money";

export type RentPeriod = "monthly" | "yearly";

export type { Currency };

export type VerificationStatus =
  | "unverified"
  | "pending"
  | "in_progress"
  | "verified"
  | "disputed"
  | "unavailable"
  | "failed";

export type DiscrepancySeverity = "low" | "medium" | "high";

export type CallStatus =
  | "queued"
  | "dialing"
  | "in_progress"
  | "completed"
  | "failed"
  /** Rang, but nobody picked up. */
  | "no_answer"
  /** The contact actively rejected the call, or hung up on it. */
  | "declined"
  | "canceled";

/** What the user is looking for, after extraction and validation. */
export interface PropertySearchRequirement {
  location: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  minRent?: number;
  maxRent?: number;
  /** Rent is never converted; the budget shares the listing's currency. */
  currency: Currency;
  rentPeriod: RentPeriod;
  moveInDate?: string;
  amenities: string[];
  additionalRequirements: string[];
}

/** A listing as advertised, before anyone has checked whether it is true. */
export interface PropertyListing {
  id: string;
  title: string;
  description: string;
  location: string;
  area: string;
  country?: string;
  propertyType: string;
  bedrooms: number;
  bathrooms?: number;
  rent: number;
  currency: Currency;
  rentPeriod: RentPeriod;
  amenities: string[];
  imageUrl?: string;
  sourceUrl?: string;
  listedAt?: string;
  agentName?: string;
  agentPhone?: string;
  verificationStatus: VerificationStatus;
  verificationScore?: number;
  verifiedData?: PropertyVerification;
}

/** A mismatch between what was advertised and what the agent said on the phone. */
export interface PropertyDiscrepancy {
  field: string;
  listedValue?: string;
  verifiedValue?: string;
  severity: DiscrepancySeverity;
  explanation: string;
}

/** Structured facts recovered from the verification phone call. */
export interface PropertyVerification {
  available: boolean;
  currentRent?: number;
  currency?: Currency;
  rentPeriod?: RentPeriod;
  bedrooms?: number;
  bathrooms?: number;

  serviceCharge?: number;
  cautionFee?: number;
  agencyFee?: number;
  legalFee?: number;

  electricityType?: string;
  waterSupply?: string;
  parkingAvailable?: boolean;
  securityAvailable?: boolean;
  generatorAvailable?: boolean;
  internetAvailable?: boolean;
  airConditioning?: boolean;

  furnished?: boolean;
  petsAllowed?: boolean;

  viewingAvailable?: boolean;
  viewingFee?: number;

  earliestMoveIn?: string;

  contactConfidence?: number;
  agentNotes?: string;

  discrepancies: PropertyDiscrepancy[];
  verifiedAt: string;
}

/** One line item in the explainable score breakdown. */
export interface ScoreComponent {
  key: string;
  label: string;
  weight: number;
  /** 0..1 — how much of `weight` this component earned. */
  ratio: number;
  earned: number;
  status: "pass" | "warn" | "fail" | "unknown";
  detail: string;
}

export interface VerificationScore {
  score: number;
  band: "Highly verified" | "Verified" | "Needs review" | "Poor match";
  components: ScoreComponent[];
  highlights: string[];
  warnings: string[];
}

/** How well a listing matches what the user asked for, ignoring verification. */
export interface RequirementMatch {
  score: number;
  reasons: string[];
  misses: string[];
}

export interface RankedProperty {
  listing: PropertyListing;
  match: RequirementMatch;
  verification?: VerificationScore;
  rankScore: number;
}

/** A transcript line from the verification call. */
export interface TranscriptTurn {
  offsetSeconds: number | null;
  speaker: "agent" | "contact" | "unknown";
  text: string;
}

/** A developer-visible step in the verification, streamed to the activity panel. */
export interface ActivityEvent {
  id: string;
  at: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
  detail?: string;
}
