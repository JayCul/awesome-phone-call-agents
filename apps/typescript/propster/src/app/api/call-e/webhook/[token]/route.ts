import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { handleRoute } from "@/server/http";
import { logger } from "@/server/logger";
import { callerIdentity, enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import { toCallResult } from "@/server/verification/calleProvider";
import { applyCallResult } from "@/server/verification/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/call-e/webhook/:token
 *
 * Terminal call events from CALL-E. Current CALL-E deliveries are UNSIGNED, so
 * this endpoint is authenticated three ways:
 *
 *  1. An unguessable token in the path (CALLE_WEBHOOK_TOKEN), compared in
 *     constant time.
 *  2. The `CALL-E-Event-Id` header must match the `id` in the body, which is
 *     the check the CALL-E docs prescribe.
 *  3. The referenced call must correspond to a verification this server
 *     actually started, matched on the metadata we sent with the call.
 *
 * Delivery is at-least-once, so the handler is idempotent: a verification that
 * has already settled is left alone.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  return handleRoute("POST /api/call-e/webhook", async () => {
    enforceRateLimit("webhook", callerIdentity(request), RATE_LIMITS.webhook);

    const { token } = await context.params;

    if (!env.calle.webhookToken || !safeEqual(token, env.calle.webhookToken)) {
      logger.warn("webhook.rejected_token");
      // Deliberately terse: do not confirm whether a token exists.
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    const rawBody = await request.text();
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      logger.warn("webhook.invalid_json");
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    if (!isWebhookEnvelope(payload)) {
      logger.warn("webhook.unexpected_shape");
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const headerEventId = request.headers.get("CALL-E-Event-Id");
    if (headerEventId && headerEventId !== payload.id) {
      logger.warn("webhook.event_id_mismatch");
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const call = payload.data;
    const verificationId = call.metadata?.propster_verification_id;

    if (typeof verificationId !== "string" || verificationId.length === 0) {
      logger.warn("webhook.missing_verification_metadata", { callId: call.id });
      // 200 so CALL-E stops retrying an event we can never act on.
      return NextResponse.json({ ok: true, ignored: "unknown_call" });
    }

    const verification = await prisma.propertyVerification.findUnique({
      where: { id: verificationId },
      include: { callSession: true },
    });

    if (!verification || verification.callSession?.providerCallId !== call.id) {
      logger.warn("webhook.unknown_verification", { callId: call.id });
      return NextResponse.json({ ok: true, ignored: "unknown_verification" });
    }

    logger.info("webhook.received", { type: payload.type, callId: call.id, verificationId });

    // `toCallResult` expects the SDK's camelCase Call; the webhook carries the
    // wire shape, so normalise before reusing the same mapping code.
    await applyCallResult(verificationId, toCallResult(normaliseCall(call)));

    return NextResponse.json({ ok: true });
  });
}

// ---------------------------------------------------------------------------

interface WireCall {
  id: string;
  status: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

interface WebhookEnvelope {
  id: string;
  type: string;
  data: WireCall;
}

function isWebhookEnvelope(value: unknown): value is WebhookEnvelope {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.type !== "string") return false;
  const data = record.data;
  if (!data || typeof data !== "object") return false;
  const call = data as Record<string, unknown>;
  return typeof call.id === "string" && typeof call.status === "string";
}

/** Convert the snake_case wire object into the SDK's camelCase Call shape. */
function normaliseCall(call: WireCall): Parameters<typeof toCallResult>[0] {
  const recipients = Array.isArray(call.recipients) ? call.recipients : [];

  return {
    id: call.id,
    object: "call_task",
    status: call.status as "queued" | "in_progress" | "completed" | "failed" | "canceled",
    task: asString(call.task) ?? "",
    summary: asString(call.summary) ?? null,
    structuredResult: asRecord(call.structured_result),
    taskCompleted: typeof call.task_completed === "boolean" ? call.task_completed : null,
    completionConfidence: asConfidence(call.completion_confidence),
    evidence: Array.isArray(call.evidence)
      ? call.evidence.filter((item): item is string => typeof item === "string")
      : [],
    metadata: (call.metadata ?? {}) as Record<string, unknown>,
    failureCode: asString(call.failure_code) ?? null,
    failureMessage: asString(call.failure_message) ?? null,
    createdAt: asString(call.created_at) ?? new Date().toISOString(),
    completedAt: asString(call.completed_at) ?? null,
    recipients: recipients.map((entry) => {
      const recipient = (entry ?? {}) as Record<string, unknown>;
      const attempts = Array.isArray(recipient.attempts) ? recipient.attempts : [];
      return {
        id: asString(recipient.id) ?? "",
        phones: Array.isArray(recipient.phones)
          ? recipient.phones.filter((p): p is string => typeof p === "string")
          : [],
        locale: asString(recipient.locale) ?? null,
        region: asString(recipient.region) ?? null,
        status: (asString(recipient.status) ?? "completed") as
          | "pending"
          | "in_progress"
          | "completed"
          | "failed"
          | "skipped",
        structuredResult: asRecord(recipient.structured_result),
        summary: asString(recipient.summary) ?? null,
        attempts: attempts.map((raw) => {
          const attempt = (raw ?? {}) as Record<string, unknown>;
          const turns = Array.isArray(attempt.transcript_turns) ? attempt.transcript_turns : [];
          return {
            id: asString(attempt.id) ?? "",
            phone: asString(attempt.phone) ?? "",
            status: (asString(attempt.status) ?? "completed") as
              | "queued"
              | "dialing"
              | "in_progress"
              | "completed"
              | "failed"
              | "canceled",
            startedAt: asString(attempt.started_at) ?? null,
            completedAt: asString(attempt.completed_at) ?? null,
            summary: asString(attempt.summary) ?? null,
            providerCallId: asString(attempt.provider_call_id) ?? null,
            failureCode: asString(attempt.failure_code) ?? null,
            failureMessage: asString(attempt.failure_message) ?? null,
            transcriptTurns: turns.map((rawTurn) => {
              const t = (rawTurn ?? {}) as Record<string, unknown>;
              return {
                offset_seconds: typeof t.offset_seconds === "number" ? t.offset_seconds : null,
                speaker: (asString(t.speaker) ?? "unknown") as "bot" | "user" | "unknown",
                text: asString(t.text) ?? "",
              };
            }),
          };
        }),
      };
    }),
  };
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asConfidence(value: unknown): { score: number; label: string } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.score !== "number") return null;
  return { score: record.score, label: asString(record.label) ?? "unknown" };
}

/** Length-independent comparison, so the token cannot be probed by timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
