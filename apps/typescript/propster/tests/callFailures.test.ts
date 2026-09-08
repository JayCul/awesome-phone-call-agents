import { describe, expect, it } from "vitest";
import { mapCallStatus, userMessageForApiCode } from "@/server/verification/calleProvider";
import { verificationStatusForCall } from "@/domain/stateMachine";
import type { Call } from "@call-e/calle";

/**
 * Regression tests for a real declined call.
 *
 * CALL-E reported the TASK as completed while the ATTEMPT was
 * "calling task status=DECLINED (Hangup by: user)", with no transcript and no
 * structured result. Propster took the completed branch, found nothing to
 * extract, and told the user "the answers could not be read reliably" — which
 * blamed extraction for a call the recipient had rejected.
 */
function buildCall(overrides: {
  status: Call["status"];
  attemptStatus?: "completed" | "failed";
  recipientStatus?: "completed" | "failed";
  failureCode?: string | null;
  failureMessage?: string | null;
}): Call {
  return {
    id: "call_test",
    object: "call_task",
    status: overrides.status,
    task: "verify",
    summary: null,
    structuredResult: null,
    taskCompleted: null,
    completionConfidence: null,
    evidence: [],
    metadata: {},
    failureCode: null,
    failureMessage: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
    recipients: [
      {
        id: "r1",
        phones: ["+447700900001"],
        locale: null,
        region: null,
        status: overrides.recipientStatus ?? "completed",
        structuredResult: null,
        summary: null,
        attempts: [
          {
            id: "a1",
            phone: "+447700900001",
            status: overrides.attemptStatus ?? "completed",
            startedAt: null,
            completedAt: null,
            summary: null,
            transcriptTurns: [],
            providerCallId: null,
            failureCode: overrides.failureCode ?? null,
            failureMessage: overrides.failureMessage ?? null,
          },
        ],
      },
    ],
  } as Call;
}

describe("declined calls", () => {
  it("reads a declined attempt even when the task says completed", () => {
    // The exact shape observed on a live call.
    const call = buildCall({
      status: "completed",
      attemptStatus: "failed",
      failureCode: "call_failed",
      failureMessage: "calling task status=DECLINED (Hangup by: user)",
    });
    expect(mapCallStatus(call)).toBe("declined");
  });

  it("does not report a declined call as completed", () => {
    const call = buildCall({
      status: "completed",
      attemptStatus: "failed",
      failureMessage: "calling task status=DECLINED (Hangup by: user)",
    });
    expect(mapCallStatus(call)).not.toBe("completed");
  });

  it("still treats a genuinely completed call as completed", () => {
    expect(mapCallStatus(buildCall({ status: "completed" }))).toBe("completed");
  });

  it("reads the SIP code, which is more precise than the prose", () => {
    // The observed call carried failure code "603" (Decline) on the attempt.
    const declined = buildCall({
      status: "failed",
      attemptStatus: "failed",
      recipientStatus: "failed",
      failureCode: "603",
    });
    expect(mapCallStatus(declined)).toBe("declined");

    const busy = buildCall({
      status: "failed",
      attemptStatus: "failed",
      recipientStatus: "failed",
      failureCode: "486",
    });
    expect(mapCallStatus(busy)).toBe("no_answer");

    const gone = buildCall({
      status: "failed",
      attemptStatus: "failed",
      recipientStatus: "failed",
      failureCode: "604",
    });
    expect(mapCallStatus(gone)).toBe("failed");
  });

  it("distinguishes no answer from a decline", () => {
    const noAnswer = buildCall({
      status: "failed",
      attemptStatus: "failed",
      failureCode: "no_answer",
    });
    expect(mapCallStatus(noAnswer)).toBe("no_answer");
  });

  it("maps every non-connecting outcome to a failed verification", () => {
    // None of these may ever produce a verified property.
    expect(verificationStatusForCall("declined")).toBe("failed");
    expect(verificationStatusForCall("no_answer")).toBe("failed");
    expect(verificationStatusForCall("canceled")).toBe("failed");
    expect(verificationStatusForCall("failed")).toBe("failed");
  });
});

/**
 * CALL-E refuses destinations it has no coverage for, and it does so with a
 * generic `provider_unavailable` code and the real reason in the prose:
 *
 *   "This call is to a Nigeria number and would use English, but Nigeria/
 *    English is not currently supported for calling."
 *
 * Reported by code alone this surfaces as "temporarily unavailable", which
 * invites a retry that cannot ever succeed. This was diagnosed from a real
 * rejection after three live calls failed for what looked like three unrelated
 * reasons.
 */
describe("an unsupported destination country", () => {
  const rejection =
    "Call task creation was rejected: This call is to a Nigeria number and would use " +
    "English, but Nigeria/English is not currently supported for calling. If you want to " +
    "continue, please provide a recipient phone number in a supported region/language " +
    "combination.";

  // CALL-E sent this as `call_not_ready`; the route layer relabels it
  // `provider_unavailable`. Neither code names the real problem, so both must
  // be read through the prose.
  it("tells the visitor the country is unsupported, not that the service is down", () => {
    const message = userMessageForApiCode("call_not_ready", rejection);

    expect(message).toMatch(/does not support calling/i);
    expect(message).not.toMatch(/temporarily unavailable/i);
  });

  it("says plainly that nobody was called", () => {
    const message = userMessageForApiCode("provider_unavailable", rejection);
    expect(userMessageForApiCode("call_not_ready", rejection)).toBe(message);
    expect(message).toMatch(/nobody was contacted/i);
  });

  it("still reports a genuine outage as an outage", () => {
    const message = userMessageForApiCode("provider_unavailable", "Upstream gateway timed out");
    expect(message).toMatch(/temporarily unavailable/i);
  });
});
