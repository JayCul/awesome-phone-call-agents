import type { CallStatus, TranscriptTurn } from "@/domain/types";

/**
 * Phone verification is behind this interface so the rest of Propster never
 * knows or cares which provider placed the call. `CallEPhoneVerificationProvider`
 * places real outbound calls; `MockPhoneVerificationProvider` replays a
 * deterministic conversation for offline demos and for CI.
 *
 * The `provider` field is recorded on every CallSession, so a simulated call
 * can never later be mistaken for a real one.
 */

export interface VerificationCallInput {
  /** The natural-language objective for the call. */
  task: string;
  /** E.164 number of the listing contact. */
  phone: string;
  /** JSON Schema describing the facts to extract from the conversation. */
  resultSchema: Record<string, unknown>;
  /** Caller-owned correlation data echoed back by the provider. */
  metadata: Record<string, string>;
  /** Stable key making retries of the same logical call safe. */
  idempotencyKey: string;
  /**
   * True when the number was entered by the person who owns it, together with
   * an explicit consent to be called. Such a number bypasses the outbound
   * allowlist, because the allowlist exists to stop Propster cold-calling
   * strangers from fabricated seed data — not to stop someone testing the
   * product on their own phone.
   */
  selfDeclared?: boolean;
  /** Optional hint used by the deterministic provider only. */
  demoScenario?: string;
  /**
   * Listing facts the deterministic provider echoes back so a simulated
   * conversation is consistent with the property being called about. Ignored
   * entirely by the live CALL-E provider, where the real conversation is the
   * only source of facts.
   */
  demoContext?: {
    rent: number;
    rentPeriod: "monthly" | "yearly";
    bedrooms: number;
    bathrooms?: number;
    propertyType: string;
  };
}

export interface CallSession {
  /** Provider-side call identifier. */
  callId: string;
  status: CallStatus;
  startedAt: string;
}

export interface CallProgressEvent {
  id: string;
  at: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
}

export interface CallResult {
  callId: string;
  status: CallStatus;
  /** Raw, unvalidated structured result from the provider. */
  structuredResult: unknown;
  transcript: TranscriptTurn[];
  summary?: string;
  taskCompleted?: boolean;
  completionConfidence?: number;
  evidence: string[];
  durationSeconds?: number;
  failureCode?: string;
  failureMessage?: string;
}

export interface PhoneVerificationProvider {
  /** Identifier persisted on the CallSession row. */
  readonly id: "call-e" | "mock";
  /** True when this provider dials a real telephone network. */
  readonly isLive: boolean;

  initiateCall(input: VerificationCallInput): Promise<CallSession>;
  getCallStatus(callId: string): Promise<CallStatus>;
  getCallResult(callId: string): Promise<CallResult>;
  /** Provider-side progress events, surfaced in the live activity panel. */
  listProgress(callId: string): Promise<CallProgressEvent[]>;
}

export class PhoneProviderError extends Error {
  constructor(
    message: string,
    readonly code: string,
    /** Message safe to show the user. */
    readonly userMessage: string,
  ) {
    super(message);
    this.name = "PhoneProviderError";
  }
}
