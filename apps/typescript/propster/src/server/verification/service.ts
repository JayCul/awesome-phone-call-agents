import "server-only";

import type { Property, PropertyVerification as VerificationRow } from "@prisma/client";
import {
  callVerificationResultSchema,
  buildCallResultJsonSchema,
  type CallVerificationResult,
} from "@/domain/schemas";
import { isReservedDemoPhone } from "@/domain/phone";
import { asCurrency, DEFAULT_CURRENCY } from "@/domain/money";
import { detectDiscrepancies, hasHighSeverity } from "@/domain/discrepancy";
import { scoreVerification } from "@/domain/scoring";
import {
  assertTransition,
  verificationStatusForCall,
} from "@/domain/stateMachine";
import type {
  CallStatus,
  PropertySearchRequirement,
  PropertyVerification,
  VerificationStatus,
} from "@/domain/types";
import { prisma } from "../db";
import { env, usingRealCalle } from "../env";
import { ApiError } from "../http";
import { logger } from "../logger";
import { activeModel } from "../llm";
import { toListing } from "../search/mockProvider";
import { buildCallObjective } from "./callObjective";
import { CallEPhoneVerificationProvider } from "./calleProvider";
import { MockPhoneVerificationProvider } from "./mockPhoneProvider";
import { extractFactsFromTranscript } from "./transcriptExtractor";
import {
  PhoneProviderError,
  type CallResult,
  type PhoneVerificationProvider,
} from "./phoneProvider";

/**
 * PropertyVerificationService orchestrates the whole verification workflow:
 * prepare the objective, place the call, follow it to a terminal state,
 * validate what came back, compare it against the listing, score it, and
 * write the result.
 *
 * No React component talks to a phone provider. Everything goes through here.
 */

/**
 * A call that has not reached a terminal state in this long has stalled.
 *
 * Measured against a real CALL-E call: the provider spent 2m30s in `queued`
 * before dialling, then held a 3m00s conversation, for ~6 minutes end to end.
 * A 6-minute budget killed a call that was actually succeeding, so the ceiling
 * is set well clear of observed worst-case latency.
 */
const CALL_TIMEOUT_MS = 20 * 60 * 1000;

let cachedProvider: PhoneVerificationProvider | null = null;

/**
 * Choose the phone provider from configuration. Real CALL-E whenever a key is
 * present and demo mode is off; the deterministic provider otherwise.
 */
export function getPhoneProvider(): PhoneVerificationProvider {
  if (cachedProvider) return cachedProvider;
  if (usingRealCalle()) {
    try {
      cachedProvider = new CallEPhoneVerificationProvider();
      logger.info("verification.provider_selected", { provider: "call-e", live: true });
      return cachedProvider;
    } catch (error) {
      // A misconfigured key must not silently downgrade to simulated calls
      // without saying so in the logs.
      logger.error("verification.calle_unavailable_using_mock", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  cachedProvider = new MockPhoneVerificationProvider();
  logger.info("verification.provider_selected", { provider: "mock", live: false });
  return cachedProvider;
}

let cachedMock: MockPhoneVerificationProvider | null = null;

function mockProvider(): MockPhoneVerificationProvider {
  cachedMock ??= new MockPhoneVerificationProvider();
  return cachedMock;
}

/**
 * Choose the provider for a specific listing, rather than for the whole app.
 *
 * The seeded demo corpus carries numbers in a reserved fictional range. Those
 * can never reach the person they purport to, so handing one to a real
 * telephone network is pointless at best: it burns call credits and, because
 * the range is syntactically valid, risks ringing whoever does own it.
 *
 * Routing them to the simulated provider means a visitor can verify any seeded
 * listing and watch the entire workflow run, while a number someone entered
 * through /try — their own, with explicit consent — still gets a real call.
 * That is what makes it safe to keep an allowlist configured in production
 * without turning the public demo into a dead end.
 */
function providerForPhone(phone: string): PhoneVerificationProvider {
  if (isReservedDemoPhone(phone)) {
    return mockProvider();
  }
  return getPhoneProvider();
}

/**
 * Resolve the provider that started a call, so polling never asks the wrong one
 * about a call it has never heard of.
 */
function providerById(id: string | null | undefined): PhoneVerificationProvider {
  return id === "mock" ? mockProvider() : getPhoneProvider();
}

/** Test seam: drop the cached provider so config changes take effect. */
export function resetPhoneProvider(): void {
  cachedProvider = null;
  cachedMock = null;
}

export interface StartVerificationInput {
  propertyId: string;
  searchId: string;
  requirement: PropertySearchRequirement;
}

export interface StartVerificationResult {
  verificationId: string;
  callId: string;
  provider: "call-e" | "mock";
  isLive: boolean;
  status: VerificationStatus;
}

/**
 * Kick off a verification. Returns as soon as the call is accepted by the
 * provider; the caller polls `/api/verifications/:id/status` from there.
 */
export async function startVerification(
  input: StartVerificationInput,
): Promise<StartVerificationResult> {
  const property = await prisma.property.findUnique({ where: { id: input.propertyId } });
  if (!property) throw ApiError.notFound("That property does not exist.");

  if (!property.agentPhone) {
    throw ApiError.badRequest(
      "Property has no contact number",
      "This listing has no phone number, so it cannot be verified by call.",
    );
  }

  // One live verification per property at a time: a second call would ring the
  // same person twice for the same question.
  const active = await prisma.propertyVerification.findFirst({
    where: { propertyId: property.id, status: { in: ["pending", "in_progress"] } },
    orderBy: { startedAt: "desc" },
  });
  if (active) {
    const session = await prisma.callSession.findUnique({ where: { verificationId: active.id } });
    return {
      verificationId: active.id,
      callId: session?.providerCallId ?? "",
      provider: (session?.provider === "call-e" ? "call-e" : "mock") as "call-e" | "mock",
      isLive: session?.provider === "call-e",
      status: asVerificationStatus(active.status),
    };
  }

  const listing = toListing(property);
  const objective = buildCallObjective(listing, input.requirement);
  const provider = providerForPhone(property.agentPhone);

  const verification = await prisma.propertyVerification.create({
    data: { propertyId: property.id, searchId: input.searchId, status: "pending" },
  });

  await moveProperty(property.id, "pending");
  await log(verification.id, "info", "Candidate selected for verification", listing.title);
  await log(
    verification.id,
    "info",
    "Verification objective prepared",
    objective.questions.length + " questions, prioritised by your requirements",
  );

  try {
    const session = await provider.initiateCall({
      task: objective.task,
      phone: property.agentPhone,
      resultSchema: buildCallResultJsonSchema(),
      metadata: {
        propster_verification_id: verification.id,
        propster_property_id: property.id,
        propster_search_id: input.searchId,
      },
      // Stable across retries of this same logical verification.
      idempotencyKey: "propster:verify:" + verification.id,
      // Consent is recorded on the property when someone submits their own
      // number through /try.
      selfDeclared: property.consentedAt !== null,
      demoScenario: property.demoScenario,
      demoContext: {
        rent: listing.rent,
        rentPeriod: listing.rentPeriod,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        propertyType: listing.propertyType,
      },
    });

    await prisma.callSession.create({
      data: {
        verificationId: verification.id,
        provider: provider.id,
        providerCallId: session.callId,
        status: session.status,
        phone: property.agentPhone,
        task: objective.task,
      },
    });

    await log(
      verification.id,
      provider.isLive ? "success" : "info",
      provider.isLive
        ? "CALL-E call created, dialing the listing contact"
        : "Simulated call created (demo mode, no real number is dialled)",
      "Call " + session.callId,
    );

    // pending -> in_progress happens on the first status poll; the call is
    // only queued at this point.
    return {
      verificationId: verification.id,
      callId: session.callId,
      provider: provider.id,
      isLive: provider.isLive,
      status: "pending",
    };
  } catch (error) {
    const failure = toFailure(error);
    await failVerification(verification.id, property.id, failure.code, failure.userMessage);
    throw ApiError.providerUnavailable(failure.message, failure.userMessage);
  }
}

export interface VerificationSnapshot {
  id: string;
  propertyId: string;
  status: VerificationStatus;
  callStatus: CallStatus | null;
  provider: "call-e" | "mock" | null;
  isLive: boolean;
  score: number | null;
  failureMessage: string | null;
  durationSeconds: number | null;
  events: Array<{ id: string; at: string; level: string; message: string; detail?: string }>;
  isTerminal: boolean;
}

/**
 * Advance a verification by polling the provider, then return the current
 * snapshot. Safe to call repeatedly; it is the engine behind the live
 * activity panel.
 */
export async function refreshVerification(verificationId: string): Promise<VerificationSnapshot> {
  const verification = await prisma.propertyVerification.findUnique({
    where: { id: verificationId },
    include: { callSession: true },
  });
  if (!verification) throw ApiError.notFound("That verification does not exist.");

  const session = verification.callSession;
  const current = asVerificationStatus(verification.status);

  if (isTerminalStatus(current) || !session?.providerCallId) {
    return snapshot(verification.id);
  }

  // Guard against a call that never reaches a terminal state.
  if (Date.now() - verification.startedAt.getTime() > CALL_TIMEOUT_MS) {
    await failVerification(
      verification.id,
      verification.propertyId,
      "timeout",
      "The verification call did not complete in time. This property has not been verified.",
    );
    return snapshot(verification.id);
  }

  const provider = providerById(session.provider);

  try {
    const callStatus = await provider.getCallStatus(session.providerCallId);
    await syncProgress(verification.id, session.providerCallId, provider);

    if (callStatus !== session.status) {
      await prisma.callSession.update({
        where: { id: session.id },
        data: { status: callStatus },
      });
    }

    if (callStatus === "completed") {
      const result = await provider.getCallResult(session.providerCallId);
      await applyCallResult(verification.id, result);
      return snapshot(verification.id);
    }

    const implied = verificationStatusForCall(callStatus);
    if (implied === "failed") {
      const result = await provider.getCallResult(session.providerCallId).catch(() => null);
      await prisma.callSession.update({
        where: { id: session.id },
        data: {
          status: callStatus,
          completedAt: new Date(),
          failureCode: result?.failureCode ?? callStatus,
          failureMessage: result?.failureMessage ?? null,
          durationSeconds: result?.durationSeconds ?? null,
        },
      });
      await failVerification(
        verification.id,
        verification.propertyId,
        result?.failureCode ?? callStatus,
        userMessageForCallFailure(
          callStatus,
          result?.failureCode,
          result?.failureMessage,
          result?.durationSeconds,
        ),
      );
      return snapshot(verification.id);
    }

    if (implied === "in_progress" && current !== "in_progress") {
      assertTransition(current, "in_progress");
      await prisma.propertyVerification.update({
        where: { id: verification.id },
        data: { status: "in_progress" },
      });
      await moveProperty(verification.propertyId, "in_progress");
    }
  } catch (error) {
    if (error instanceof PhoneProviderError) {
      logger.warn("verification.poll_failed", {
        verificationId,
        code: error.code,
      });
      // A transient provider hiccup should not destroy an in-flight
      // verification; only a hard credential or policy error is terminal.
      if (isFatalProviderCode(error.code)) {
        await failVerification(
          verification.id,
          verification.propertyId,
          error.code,
          error.userMessage,
        );
      }
    } else {
      throw error;
    }
  }

  return snapshot(verification.id);
}

/**
 * Validate the provider's structured result, compare it against the listing,
 * score it, and persist. This is the only path to a `verified` state.
 */
export async function applyCallResult(
  verificationId: string,
  result: CallResult,
): Promise<void> {
  const verification = await prisma.propertyVerification.findUnique({
    where: { id: verificationId },
    include: { callSession: true, property: true },
  });
  if (!verification) throw ApiError.notFound("That verification does not exist.");
  if (isTerminalStatus(asVerificationStatus(verification.status))) return; // already settled

  // Claim the verification atomically. A poll and a webhook can arrive at the
  // same moment; whichever wins the conditional update settles the result and
  // the other returns without double-writing.
  const claimed = await prisma.propertyVerification.updateMany({
    where: { id: verificationId, status: { in: ["pending", "in_progress"] } },
    data: { status: "in_progress" },
  });
  if (claimed.count === 0) return;

  const property = verification.property;

  if (verification.callSession) {
    await prisma.callSession.update({
      where: { id: verification.callSession.id },
      data: {
        status: result.status,
        transcript: JSON.stringify(result.transcript),
        summary: result.summary ?? null,
        rawResult: result.structuredResult === null ? null : JSON.stringify(result.structuredResult),
        taskCompleted: result.taskCompleted ?? null,
        completionConfidence: result.completionConfidence ?? null,
        evidence: JSON.stringify(result.evidence),
        durationSeconds: result.durationSeconds ?? null,
        completedAt: new Date(),
        failureCode: result.failureCode ?? null,
        failureMessage: result.failureMessage ?? null,
      },
    });
  }

  const listing = toListing(property);

  // Two routes to structured facts, in order of preference.
  //
  //  1. The provider extracted them server-side against our JSON Schema.
  //  2. The provider only returned a transcript, so Propster extracts them
  //     itself. This is the live CALL-E path: that API rejects both schema
  //     fields on this plan and always returns a null structured result.
  //
  // Either way the facts are schema-validated before anything downstream sees
  // them, and failure to produce valid facts is a failed verification rather
  // than a silent pass.
  let facts: CallVerificationResult | null = null;
  let factsSource = "provider";

  const direct = callVerificationResultSchema.safeParse(result.structuredResult);
  if (direct.success) {
    facts = direct.data;
  } else if (result.transcript.length > 0) {
    const extracted = await extractFactsFromTranscript(result.transcript, listing);
    if (extracted) {
      facts = extracted.facts;
      factsSource = extracted.source;
    }
  }

  if (!facts) {
    // A call that produced nothing at all is not an extraction failure.
    //
    // Blaming extraction when there was never a conversation to extract from
    // tells the user the wrong thing: an observed call was declined by the
    // recipient, and Propster reported that "the answers could not be read
    // reliably". The two cases are distinguished by whether there was any
    // material to work with.
    const producedNothing = result.structuredResult === null && result.transcript.length === 0;

    logger.warn("verification.no_usable_facts", {
      verificationId,
      producedNothing,
      callStatus: result.status,
      failureCode: result.failureCode,
      transcriptTurns: result.transcript.length,
    });

    if (producedNothing) {
      await failVerification(
        verificationId,
        property.id,
        result.failureCode ?? result.status,
        userMessageForCallFailure(
          result.status,
          result.failureCode,
          result.failureMessage,
          result.durationSeconds,
        ),
      );
    } else {
      await failVerification(
        verificationId,
        property.id,
        "extraction_failed",
        "The call connected but the answers could not be read reliably. This property has not been verified.",
      );
    }
    return;
  }

  logger.info("verification.facts_extracted", { verificationId, source: factsSource });
  await log(
    verificationId,
    "info",
    factsSource === "provider"
      ? "Structured facts returned by the call provider"
      : factsSource === "model"
        ? "Facts extracted from the call transcript by " + (activeModel() ?? "a language model")
        : "Facts extracted from the call transcript by the built-in parser",
  );

  if (!facts.reached_contact) {
    await failVerification(
      verificationId,
      property.id,
      "contact_not_reached",
      "Nobody was reached on this number, so the listing could not be verified.",
    );
    return;
  }

  const requirement = await requirementForSearch(verification.searchId);

  const verifiedFacts = toDomainVerification(facts, result);
  const discrepancies = detectDiscrepancies(listing, verifiedFacts);
  const full: PropertyVerification = { ...verifiedFacts, discrepancies };
  const breakdown = scoreVerification(listing, full, requirement);

  const nextStatus: VerificationStatus = !full.available
    ? "unavailable"
    : hasHighSeverity(discrepancies)
      ? "disputed"
      : "verified";

  // The claim above put the row in `in_progress`, so that is the state we are
  // transitioning out of regardless of what it was when we loaded it.
  assertTransition("in_progress", nextStatus);

  await prisma.$transaction(async (tx) => {
    await tx.propertyVerification.update({
      where: { id: verificationId },
      data: {
        status: nextStatus,
        available: full.available,
        currentRent: full.currentRent ?? null,
        currency: full.currency ?? null,
        rentPeriod: full.rentPeriod ?? null,
        bedrooms: full.bedrooms ?? null,
        bathrooms: full.bathrooms ?? null,
        serviceCharge: full.serviceCharge ?? null,
        cautionFee: full.cautionFee ?? null,
        agencyFee: full.agencyFee ?? null,
        legalFee: full.legalFee ?? null,
        electricityType: full.electricityType ?? null,
        waterSupply: full.waterSupply ?? null,
        parkingAvailable: full.parkingAvailable ?? null,
        securityAvailable: full.securityAvailable ?? null,
        generatorAvailable: full.generatorAvailable ?? null,
        internetAvailable: full.internetAvailable ?? null,
        airConditioning: full.airConditioning ?? null,
        furnished: full.furnished ?? null,
        petsAllowed: full.petsAllowed ?? null,
        viewingAvailable: full.viewingAvailable ?? null,
        viewingFee: full.viewingFee ?? null,
        earliestMoveIn: full.earliestMoveIn ?? null,
        agentNotes: full.agentNotes ?? null,
        contactConfidence: full.contactConfidence ?? null,
        score: breakdown.score,
        scoreBreakdown: JSON.stringify(breakdown),
        verifiedAt: new Date(),
      },
    });

    await tx.discrepancy.deleteMany({ where: { verificationId } });
    if (discrepancies.length > 0) {
      await tx.discrepancy.createMany({
        data: discrepancies.map((d) => ({
          verificationId,
          field: d.field,
          listedValue: d.listedValue ?? null,
          verifiedValue: d.verifiedValue ?? null,
          severity: d.severity,
          explanation: d.explanation,
        })),
      });
    }

    await tx.property.update({
      where: { id: property.id },
      data: { verificationStatus: nextStatus, verificationScore: breakdown.score },
    });
  });

  for (const highlight of breakdown.highlights) {
    await log(verificationId, "success", highlight);
  }
  for (const discrepancy of discrepancies) {
    await log(verificationId, "warning", discrepancy.explanation, discrepancy.field);
  }
  await log(
    verificationId,
    nextStatus === "verified" ? "success" : nextStatus === "unavailable" ? "warning" : "warning",
    nextStatus === "verified"
      ? "Verification complete: " + breakdown.score + "% verified"
      : nextStatus === "unavailable"
        ? "Property is no longer available"
        : "Verification complete with discrepancies: " + breakdown.score + "%",
  );

  logger.info("verification.settled", {
    verificationId,
    status: nextStatus,
    score: breakdown.score,
    discrepancies: discrepancies.length,
  });
}

/** Map the validated call result onto the domain verification shape. */
export function toDomainVerification(
  facts: CallVerificationResult,
  result: Pick<CallResult, "completionConfidence" | "summary">,
): Omit<PropertyVerification, "discrepancies"> & { discrepancies: [] } {
  const num = (value: number | null | undefined) => (value === null ? undefined : value);
  const bool = (value: boolean | null | undefined) => (value === null ? undefined : value);
  const str = (value: string | null | undefined) =>
    value === null || value === undefined || value.trim() === "" ? undefined : value.trim();

  return {
    available: facts.property_available === true,
    currentRent: num(facts.current_rent),
    rentPeriod: facts.rent_period === null ? undefined : facts.rent_period,
    bedrooms: num(facts.bedrooms),
    bathrooms: num(facts.bathrooms),
    serviceCharge: num(facts.service_charge),
    cautionFee: num(facts.caution_fee),
    agencyFee: num(facts.agency_fee),
    legalFee: num(facts.legal_fee),
    electricityType: str(facts.electricity_type),
    waterSupply: str(facts.water_supply),
    parkingAvailable: bool(facts.parking_available),
    securityAvailable: bool(facts.security_available),
    generatorAvailable: bool(facts.generator_available),
    internetAvailable: bool(facts.internet_available),
    airConditioning: bool(facts.air_conditioning),
    furnished: bool(facts.furnished),
    petsAllowed: bool(facts.pets_allowed),
    viewingAvailable: bool(facts.viewing_available),
    viewingFee: num(facts.viewing_fee),
    earliestMoveIn: str(facts.earliest_move_in),
    agentNotes: str(facts.agent_notes),
    contactConfidence: result.completionConfidence,
    verifiedAt: new Date().toISOString(),
    discrepancies: [],
  };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function syncProgress(
  verificationId: string,
  callId: string,
  provider: PhoneVerificationProvider,
): Promise<void> {
  const events = (await provider.listProgress(callId)).filter(isMeaningfulProgress);
  if (events.length === 0) return;

  // Upsert on (verificationId, sourceId). Overlapping polls would otherwise
  // both read "not present" and both insert, so uniqueness has to be enforced
  // by the database rather than by a read-then-write check.
  for (const event of events) {
    await prisma.verificationEvent.upsert({
      where: { verificationId_sourceId: { verificationId, sourceId: event.id } },
      update: {},
      create: {
        verificationId,
        sourceId: event.id,
        level: event.level,
        message: event.message,
      },
    });
  }
}

/**
 * CALL-E emits a `call.updated` event for every incremental speech-recognition
 * token, so a three-minute call produces hundreds of near-identical
 * "Callee said: ..." lines. Those are the transcript, not progress, and the
 * transcript is shown in full on the detail page. Keep only the lifecycle
 * events a person would actually want to watch.
 */
function isMeaningfulProgress(event: { message: string }): boolean {
  return !/^\s*(callee said|bot is speaking|user said|assistant said)\s*:/i.test(event.message);
}

async function failVerification(
  verificationId: string,
  propertyId: string,
  code: string,
  userMessage: string,
): Promise<void> {
  const current = await prisma.propertyVerification.findUnique({
    where: { id: verificationId },
    select: { status: true },
  });
  if (!current || isTerminalStatus(asVerificationStatus(current.status))) return;

  await prisma.propertyVerification.update({
    where: { id: verificationId },
    data: { status: "failed", failureCode: code, failureMessage: userMessage },
  });
  // The property returns to unverified, never to a verified state: a failed
  // call tells us nothing about the listing.
  await prisma.property.update({
    where: { id: propertyId },
    data: { verificationStatus: "unverified", verificationScore: null },
  });
  await log(verificationId, "error", userMessage, code);
  logger.warn("verification.failed", { verificationId, code });
}

async function moveProperty(propertyId: string, status: VerificationStatus): Promise<void> {
  await prisma.property.update({ where: { id: propertyId }, data: { verificationStatus: status } });
}

async function log(
  verificationId: string,
  level: "info" | "success" | "warning" | "error",
  message: string,
  detail?: string,
): Promise<void> {
  await prisma.verificationEvent.create({
    data: { verificationId, level, message, detail: detail ?? null },
  });
}

async function snapshot(verificationId: string): Promise<VerificationSnapshot> {
  const verification = await prisma.propertyVerification.findUnique({
    where: { id: verificationId },
    include: { callSession: true, events: { orderBy: { createdAt: "asc" } } },
  });
  if (!verification) throw ApiError.notFound("That verification does not exist.");

  const status = asVerificationStatus(verification.status);
  return {
    id: verification.id,
    propertyId: verification.propertyId,
    status,
    callStatus: (verification.callSession?.status as CallStatus | undefined) ?? null,
    provider:
      verification.callSession?.provider === "call-e"
        ? "call-e"
        : verification.callSession
          ? "mock"
          : null,
    isLive: verification.callSession?.provider === "call-e",
    score: verification.score,
    failureMessage: verification.failureMessage,
    durationSeconds: verification.callSession?.durationSeconds ?? null,
    events: verification.events.map((event) => ({
      id: event.id,
      at: event.createdAt.toISOString(),
      level: event.level,
      message: event.message,
      detail: event.detail ?? undefined,
    })),
    isTerminal: isTerminalStatus(status),
  };
}

async function requirementForSearch(searchId: string): Promise<PropertySearchRequirement> {
  const search = await prisma.search.findUnique({ where: { id: searchId } });
  if (!search) {
    // A verification whose search has been pruned still needs criteria to
    // score against; fall back to an empty requirement rather than throwing.
    return {
      location: "",
      currency: DEFAULT_CURRENCY,
      rentPeriod: "yearly",
      amenities: [],
      additionalRequirements: [],
    };
  }
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
    amenities: safeParseArray(search.amenities),
    additionalRequirements: safeParseArray(search.additionalRequirements),
  };
}

function safeParseArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function isTerminalStatus(status: VerificationStatus): boolean {
  return (
    status === "verified" ||
    status === "disputed" ||
    status === "unavailable" ||
    status === "failed"
  );
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

function isFatalProviderCode(code: string): boolean {
  return [
    "unauthorized",
    "missing_credentials",
    "invalid_phone",
    "phone_not_allowlisted",
    "recipient_blocked",
    "policy_violation",
    "insufficient_balance",
    "not_found",
  ].includes(code);
}

/**
 * Say what actually happened, in the user's terms.
 *
 * The distinction matters: "nobody picked up" invites a retry later, "they
 * declined" suggests the contact does not want automated calls, and neither is
 * the same as the software failing. The provider's own message is searched as
 * well as its code, because an observed declined call carried the detail only
 * in the message.
 */
function userMessageForCallFailure(
  status: CallStatus,
  code?: string,
  providerMessage?: string,
  durationSeconds?: number,
): string {
  const haystack = ((code ?? "") + " " + (providerMessage ?? "")).toLowerCase();

  if (
    status === "declined" ||
    haystack.includes("declin") ||
    haystack.includes("reject") ||
    haystack.includes("hangup by")
  ) {
    // A decline that lasted no time at all was refused by the network before
    // the handset rang: carrier spam filtering, a do-not-disturb registration,
    // or international call barring. Telling someone "they declined" when the
    // phone never rang sends them looking in the wrong place.
    if (durationSeconds !== undefined && durationSeconds <= 1) {
      return "The call was refused by the network before it rang. The number may be blocking automated or international calls.";
    }
    return "The contact declined the call, so this property has not been verified.";
  }
  if (
    status === "no_answer" ||
    haystack.includes("no_answer") ||
    haystack.includes("no answer") ||
    haystack.includes("busy")
  ) {
    return "Nobody answered on the listing's number, so it has not been verified.";
  }
  if (status === "canceled" || haystack.includes("cancel")) {
    return "The verification call was cancelled before it completed.";
  }
  return "The verification call did not complete. This property has not been verified.";
}

function toFailure(error: unknown): { code: string; message: string; userMessage: string } {
  if (error instanceof PhoneProviderError) {
    return { code: error.code, message: error.message, userMessage: error.userMessage };
  }
  return {
    code: "unknown",
    message: error instanceof Error ? error.message : String(error),
    userMessage: "Unable to verify this property right now.",
  };
}

export { env as verificationEnv };
export type { VerificationRow, Property };
