import type { CallStatus, VerificationStatus } from "./types";

/**
 * Verification state machine.
 *
 * The one rule that matters: a verification can only reach `verified` from
 * `in_progress` with a real call result. There is no path from a failure into
 * a success, so a dropped call, a busy line or an unparseable result can never
 * be presented to the user as a confirmed property.
 */

const TRANSITIONS: Record<VerificationStatus, readonly VerificationStatus[]> = {
  unverified: ["pending", "failed"],
  pending: ["in_progress", "failed"],
  in_progress: ["verified", "disputed", "unavailable", "failed"],
  // Terminal states can only be re-entered by starting a fresh verification.
  verified: ["pending"],
  disputed: ["pending"],
  unavailable: ["pending"],
  failed: ["pending"],
};

export function canTransition(from: VerificationStatus, to: VerificationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class InvalidVerificationTransition extends Error {
  constructor(
    readonly from: VerificationStatus,
    readonly to: VerificationStatus,
  ) {
    super("Cannot move verification from " + from + " to " + to);
    this.name = "InvalidVerificationTransition";
  }
}

export function assertTransition(from: VerificationStatus, to: VerificationStatus): void {
  if (!canTransition(from, to)) throw new InvalidVerificationTransition(from, to);
}

export function isTerminal(status: VerificationStatus): boolean {
  return (
    status === "verified" ||
    status === "disputed" ||
    status === "unavailable" ||
    status === "failed"
  );
}

/** Map a provider call status onto the verification status it implies. */
export function verificationStatusForCall(call: CallStatus): VerificationStatus | null {
  switch (call) {
    case "queued":
      return "pending";
    case "dialing":
    case "in_progress":
      return "in_progress";
    case "failed":
    case "no_answer":
    case "declined":
    case "canceled":
      return "failed";
    case "completed":
      // A completed call still has to be interpreted before we know whether
      // it produced a verification, a dispute or an unavailable property.
      return null;
  }
}

export const STATUS_LABELS: Record<VerificationStatus, string> = {
  unverified: "Unverified",
  pending: "Queued for verification",
  in_progress: "Verification in progress",
  verified: "Verified",
  disputed: "Disputed",
  unavailable: "Not available",
  failed: "Verification failed",
};
