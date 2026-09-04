import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  InvalidVerificationTransition,
  isTerminal,
  verificationStatusForCall,
} from "@/domain/stateMachine";
import { callVerificationResultSchema } from "@/domain/schemas";

describe("verification state machine", () => {
  it("walks the happy path", () => {
    expect(canTransition("unverified", "pending")).toBe(true);
    expect(canTransition("pending", "in_progress")).toBe(true);
    expect(canTransition("in_progress", "verified")).toBe(true);
  });

  it("allows the disputed and unavailable outcomes from in_progress", () => {
    expect(canTransition("in_progress", "disputed")).toBe(true);
    expect(canTransition("in_progress", "unavailable")).toBe(true);
  });

  it("allows failure from every non-terminal state", () => {
    expect(canTransition("unverified", "failed")).toBe(true);
    expect(canTransition("pending", "failed")).toBe(true);
    expect(canTransition("in_progress", "failed")).toBe(true);
  });

  it("refuses to skip straight from unverified to verified", () => {
    expect(canTransition("unverified", "verified")).toBe(false);
    expect(() => assertTransition("unverified", "verified")).toThrow(
      InvalidVerificationTransition,
    );
  });

  it("refuses to turn a failed verification into a verified one", () => {
    expect(canTransition("failed", "verified")).toBe(false);
    expect(canTransition("failed", "disputed")).toBe(false);
    // The only way out of a failure is to start again.
    expect(canTransition("failed", "pending")).toBe(true);
  });

  it("refuses to promote a disputed result to verified without a new call", () => {
    expect(canTransition("disputed", "verified")).toBe(false);
    expect(canTransition("unavailable", "verified")).toBe(false);
  });

  it("identifies terminal states", () => {
    expect(isTerminal("verified")).toBe(true);
    expect(isTerminal("disputed")).toBe(true);
    expect(isTerminal("unavailable")).toBe(true);
    expect(isTerminal("failed")).toBe(true);
    expect(isTerminal("pending")).toBe(false);
    expect(isTerminal("in_progress")).toBe(false);
  });
});

describe("verificationStatusForCall", () => {
  it("maps provider call states onto verification states", () => {
    expect(verificationStatusForCall("queued")).toBe("pending");
    expect(verificationStatusForCall("dialing")).toBe("in_progress");
    expect(verificationStatusForCall("in_progress")).toBe("in_progress");
    expect(verificationStatusForCall("failed")).toBe("failed");
    expect(verificationStatusForCall("no_answer")).toBe("failed");
    expect(verificationStatusForCall("canceled")).toBe("failed");
  });

  it("leaves a completed call to be interpreted, not auto-passed", () => {
    // A completed call may still be a dispute or an unavailable property.
    expect(verificationStatusForCall("completed")).toBeNull();
  });
});

describe("call result validation", () => {
  it("accepts a well-formed provider result", () => {
    const result = callVerificationResultSchema.safeParse({
      reached_contact: true,
      property_available: true,
      current_rent: 7_500_000,
      rent_period: "yearly",
      bedrooms: 3,
      parking_available: true,
      electricity_type: "prepaid meter",
    });
    expect(result.success).toBe(true);
  });

  it("accepts nulls for questions the contact did not answer", () => {
    const result = callVerificationResultSchema.safeParse({
      reached_contact: true,
      property_available: true,
      service_charge: null,
      caution_fee: null,
      parking_available: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a result missing the mandatory fields", () => {
    expect(callVerificationResultSchema.safeParse({ current_rent: 7_500_000 }).success).toBe(
      false,
    );
  });

  it("rejects a malformed result rather than coercing it", () => {
    const result = callVerificationResultSchema.safeParse({
      reached_contact: "yes",
      property_available: "maybe",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range bedroom count", () => {
    const result = callVerificationResultSchema.safeParse({
      reached_contact: true,
      property_available: true,
      bedrooms: 400,
    });
    expect(result.success).toBe(false);
  });
});
