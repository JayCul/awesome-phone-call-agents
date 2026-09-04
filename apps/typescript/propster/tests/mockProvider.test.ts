import { describe, expect, it } from "vitest";
import { MockPhoneVerificationProvider } from "@/server/verification/mockPhoneProvider";

/**
 * The simulated provider must be stateless.
 *
 * On a serverless host each request may be served by a different instance, so
 * a provider that remembered calls in module memory would fail every status
 * poll that did not happen to land back on the instance that started the call.
 * These tests assert that a *fresh* provider instance — standing in for a
 * different serverless worker — can answer for a call it never created.
 */
const input = {
  task: "verify",
  phone: "+2347000000001",
  resultSchema: {},
  metadata: {},
  idempotencyKey: "propster:verify:abc123",
  demoScenario: "price_mismatch",
  demoContext: {
    rent: 6_800_000,
    currency: "EUR",
    rentPeriod: "yearly" as const,
    bedrooms: 3,
    bathrooms: 3,
    propertyType: "apartment",
  },
};

describe("MockPhoneVerificationProvider (stateless)", () => {
  it("lets a different instance resolve a call it did not create", async () => {
    const starter = new MockPhoneVerificationProvider();
    const session = await starter.initiateCall(input);

    // A different worker, with no shared memory.
    const other = new MockPhoneVerificationProvider();
    await expect(other.getCallStatus(session.callId)).resolves.toBeDefined();
    await expect(other.getCallResult(session.callId)).resolves.toBeDefined();
  });

  it("carries the scenario and listing context through the call id", async () => {
    const starter = new MockPhoneVerificationProvider();
    const session = await starter.initiateCall(input);

    const other = new MockPhoneVerificationProvider();
    const progress = await other.listProgress(session.callId);
    expect(progress.length).toBeGreaterThan(0);
  });

  it("rejects an unparseable call id rather than inventing a call", async () => {
    const provider = new MockPhoneVerificationProvider();
    await expect(provider.getCallStatus("mock_not-valid-base64!!")).rejects.toThrow();
    await expect(provider.getCallStatus("call_something_else")).rejects.toThrow();
  });
});
