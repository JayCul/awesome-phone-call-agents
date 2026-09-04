import "server-only";

import {
  CalleClient,
  CalleAPIError,
  CalleAuthenticationError,
  CalleConnectionError,
  CalleRateLimitError,
  CalleTimeoutError,
  type Call,
} from "@call-e/calle";
import type { CallStatus, TranscriptTurn } from "@/domain/types";
import { calleWebhookUrl, env } from "../env";
import { logger } from "../logger";
import {
  PhoneProviderError,
  type CallProgressEvent,
  type CallResult,
  type CallSession,
  type PhoneVerificationProvider,
  type VerificationCallInput,
} from "./phoneProvider";

/**
 * Real outbound phone verification through CALL-E.
 *
 * CALL-E holds the conversation and extracts a structured result against the
 * JSON Schema we supply, so Propster receives typed facts rather than a raw
 * transcript to parse. The transcript is still stored, because the user should
 * be able to read what was actually said.
 *
 * The API key lives only in this module's process. Nothing here is importable
 * from a client component.
 */
export class CallEPhoneVerificationProvider implements PhoneVerificationProvider {
  readonly id = "call-e" as const;
  readonly isLive = true;

  private readonly client: CalleClient;

  constructor() {
    if (!env.calle.apiKey) {
      throw new PhoneProviderError(
        "CALLE_API_KEY is not configured",
        "missing_credentials",
        "Phone verification is not configured on this server.",
      );
    }
    this.client = new CalleClient({
      apiKey: env.calle.apiKey,
      baseUrl: env.calle.baseUrl,
    });
  }

  async initiateCall(input: VerificationCallInput): Promise<CallSession> {
    assertDialable(input.phone, input.selfDeclared === true);

    const webhookUrl = calleWebhookUrl();

    try {
      const call = await this.client.calls.create(
        {
          task: input.task,
          recipients: [{ phones: [input.phone], region: "NG", locale: "en-NG" }],
          // No result schema is sent.
          //
          // The SDK's types expose both `resultSchema` and
          // `recipientResultSchema`, but this deployment rejects both
          // ("result_schema is not supported" / "recipient_result_schema is not
          // supported") — server-side structured extraction is not available on
          // every CALL-E plan. Propster therefore treats CALL-E as a
          // conversation engine only, and extracts the structured facts from
          // the returned transcript itself. See `transcriptExtractor.ts`.
          metadata: input.metadata,
          ...(webhookUrl ? { webhookUrl } : {}),
        },
        { idempotencyKey: input.idempotencyKey },
      );

      logger.info("calle.call_created", {
        callId: call.id,
        status: call.status,
        delivery: webhookUrl ? "webhook" : "polling",
      });

      return {
        callId: call.id,
        status: mapCallStatus(call),
        startedAt: call.createdAt,
      };
    } catch (error) {
      throw translateError(error);
    }
  }

  async getCallStatus(callId: string): Promise<CallStatus> {
    try {
      return mapCallStatus(await this.client.calls.get(callId));
    } catch (error) {
      throw translateError(error);
    }
  }

  async getCallResult(callId: string): Promise<CallResult> {
    try {
      return toCallResult(await this.client.calls.get(callId));
    } catch (error) {
      throw translateError(error);
    }
  }

  async listProgress(callId: string): Promise<CallProgressEvent[]> {
    try {
      const events = await this.client.calls.listEvents(callId, { limit: 50 });
      return events.data.map((event) => ({
        id: event.id,
        at: event.created_at,
        level: mapLevel(event.level),
        message: event.message,
      }));
    } catch (error) {
      // Progress is a nice-to-have; never fail a verification because the
      // event feed is unavailable.
      logger.warn("calle.events_unavailable", {
        callId,
        message: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}

/**
 * Translate a CALL-E call object into Propster's call status.
 *
 * CALL-E reports "completed" for the task as a whole; a recipient that was
 * never reached is a failed verification even though the task completed
 * cleanly, so the recipient state is checked too.
 */
export function mapCallStatus(call: Call): CallStatus {
  switch (call.status) {
    case "queued":
      return "queued";
    case "in_progress": {
      const attempt = call.recipients[0]?.attempts.at(-1);
      if (attempt?.status === "dialing") return "dialing";
      return "in_progress";
    }
    case "canceled":
      return "canceled";
    case "failed": {
      const attempt = call.recipients[0]?.attempts.at(-1);
      return failureToStatus(
        call.failureCode ?? attempt?.failureCode,
        call.failureMessage ?? attempt?.failureMessage,
      );
    }
    case "completed": {
      const recipient = call.recipients[0];
      const attempt = recipient?.attempts.at(-1);

      // CALL-E can mark the TASK completed while the ATTEMPT failed, and the
      // two do not always flip in the same poll. An observed call reported
      // task=completed with attempt DECLINED, which read as a successful call
      // that produced nothing. Trust the attempt whenever it says it failed.
      if (recipient?.status === "failed" || attempt?.status === "failed") {
        return failureToStatus(attempt?.failureCode, attempt?.failureMessage);
      }
      return "completed";
    }
  }
}

/**
 * Classify why a call did not produce a conversation.
 *
 * CALL-E reports the reason in two places and not always the same way: a
 * machine-readable `failure_code`, and a human string on the attempt such as
 * "calling task status=DECLINED (Hangup by: user)". Both are searched, because
 * an observed live call carried the useful detail only in the message.
 */
/**
 * SIP response codes CALL-E passes through verbatim as the attempt's failure
 * code. They are far more precise than the prose that accompanies them: an
 * observed rejected call carried failure code "603" with a duration of zero
 * seconds, which is the network declining before the handset ever rang.
 */
const SIP_STATUS: Record<string, CallStatus> = {
  "486": "no_answer", // Busy Here
  "480": "no_answer", // Temporarily Unavailable
  "408": "no_answer", // Request Timeout
  "603": "declined", // Decline
  "607": "declined", // Unwanted, reported as spam by the callee
  "403": "declined", // Forbidden, typically a network-level block
  "604": "failed", // Does Not Exist Anywhere
  "484": "failed", // Address Incomplete
  "487": "canceled", // Request Terminated
};

function failureToStatus(
  failureCode: string | null | undefined,
  failureMessage?: string | null,
): CallStatus {
  const code = (failureCode ?? "").trim();
  const bySip = SIP_STATUS[code];
  if (bySip) return bySip;

  const haystack = (code + " " + (failureMessage ?? "")).toLowerCase();
  if (haystack.trim() === "") return "failed";
  if (haystack.includes("declin") || haystack.includes("reject") || haystack.includes("hangup by")) {
    return "declined";
  }
  if (
    haystack.includes("no_answer") ||
    haystack.includes("noanswer") ||
    haystack.includes("no answer") ||
    haystack.includes("busy")
  ) {
    return "no_answer";
  }
  if (haystack.includes("cancel")) return "canceled";
  return "failed";
}

export function toCallResult(call: Call): CallResult {
  const recipient = call.recipients[0];
  const attempt = recipient?.attempts.at(-1);

  const transcript: TranscriptTurn[] = (attempt?.transcriptTurns ?? []).map((turn) => ({
    offsetSeconds: turn.offset_seconds,
    // CALL-E labels our own agent "bot" and the person who answered "user".
    speaker: turn.speaker === "bot" ? "agent" : turn.speaker === "user" ? "contact" : "unknown",
    text: turn.text,
  }));

  const durationSeconds =
    attempt?.startedAt && attempt.completedAt
      ? Math.max(
          0,
          Math.round(
            (new Date(attempt.completedAt).getTime() - new Date(attempt.startedAt).getTime()) / 1000,
          ),
        )
      : undefined;

  return {
    callId: call.id,
    status: mapCallStatus(call),
    structuredResult: recipient?.structuredResult ?? null,
    transcript,
    summary: recipient?.summary ?? call.summary ?? undefined,
    taskCompleted: call.taskCompleted ?? undefined,
    completionConfidence: call.completionConfidence?.score ?? undefined,
    evidence: call.evidence ?? [],
    durationSeconds,
    failureCode: call.failureCode ?? attempt?.failureCode ?? undefined,
    failureMessage: call.failureMessage ?? attempt?.failureMessage ?? undefined,
  };
}

function mapLevel(level: "debug" | "info" | "warning" | "error"): CallProgressEvent["level"] {
  if (level === "error") return "error";
  if (level === "warning") return "warning";
  return "info";
}

/**
 * Guard rail: a bug in ranking must never be able to dial an arbitrary number.
 * When an allowlist is configured, only those numbers can be called.
 */
function assertDialable(phone: string, selfDeclared: boolean): void {
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new PhoneProviderError(
      "Phone number is not in E.164 form",
      "invalid_phone",
      "This listing has no usable phone number, so it cannot be verified.",
    );
  }
  // A number its owner typed in and consented to is always dialable. Everything
  // else must clear the allowlist when one is configured.
  if (selfDeclared) return;
  if (env.calle.allowlist.length > 0 && !env.calle.allowlist.includes(phone)) {
    throw new PhoneProviderError(
      "Phone number is not on the configured allowlist",
      "phone_not_allowlisted",
      "This number is not on the outbound call allowlist for this deployment.",
    );
  }
}

/** Map CALL-E SDK errors onto a stable, user-safe shape. */
function translateError(error: unknown): PhoneProviderError {
  if (error instanceof PhoneProviderError) return error;

  if (error instanceof CalleAuthenticationError) {
    return new PhoneProviderError(
      "CALL-E rejected the API key",
      "unauthorized",
      "Phone verification is not configured correctly on this server.",
    );
  }
  if (error instanceof CalleRateLimitError) {
    return new PhoneProviderError(
      "CALL-E rate limit reached",
      "rate_limited",
      "Too many verification calls at once. Try again shortly.",
    );
  }
  if (error instanceof CalleTimeoutError) {
    return new PhoneProviderError(
      "CALL-E request timed out",
      "timeout",
      "The call service did not respond in time. The property has not been verified.",
    );
  }
  if (error instanceof CalleConnectionError) {
    return new PhoneProviderError(
      "Could not reach CALL-E",
      "connection_failed",
      "Could not reach the call service. The property has not been verified.",
    );
  }
  if (error instanceof CalleAPIError) {
    const code = typeof error.code === "string" ? error.code : "api_error";
    return new PhoneProviderError(error.message, code, userMessageForApiCode(code));
  }

  return new PhoneProviderError(
    error instanceof Error ? error.message : String(error),
    "unknown",
    "Unable to verify this property right now.",
  );
}

function userMessageForApiCode(code: string): string {
  switch (code) {
    case "insufficient_balance":
      return "The call account has no remaining balance, so this property could not be verified.";
    case "invalid_phone":
    case "invalid_recipient":
      return "This listing's contact number was rejected by the call service.";
    case "recipient_blocked":
      return "This contact has opted out of automated calls, so it cannot be verified.";
    case "unsupported_region":
      return "Calls to this contact's region are not supported.";
    case "policy_violation":
      return "The call service declined this verification request.";
    case "provider_unavailable":
      return "The call service is temporarily unavailable. The property has not been verified.";
    default:
      return "Unable to verify this property right now.";
  }
}
