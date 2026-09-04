import { describe, expect, it } from "vitest";
import { mapCallStatus } from "@/server/verification/calleProvider";
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
