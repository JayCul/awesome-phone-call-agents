import { describe, expect, it } from "vitest";
import { callVerificationResultSchema } from "@/domain/schemas";
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

/**
 * The simulated conversation has to hold up in every market Propster covers.
 *
 * The fee figures are derived from the listing's own rent, and an earlier
 * version rounded each of them to the nearest 100,000 — a step that reads
 * naturally for a rent quoted in millions and annihilates a four-figure
 * European one. A EUR 1,650/month flat came back from the "rent went up"
 * scenario quoting an increased rent of zero, which then scored as a confirmed
 * fact.
 */
describe("MockPhoneVerificationProvider (currency scale)", () => {
  interface DemoContext {
    rent: number;
    currency: string;
    rentPeriod: "monthly" | "yearly";
    bedrooms: number;
    bathrooms: number;
    propertyType: string;
  }

  const euroContext: DemoContext = {
    rent: 1_650,
    currency: "EUR",
    rentPeriod: "monthly",
    bedrooms: 2,
    bathrooms: 1,
    propertyType: "apartment",
  };

  /**
   * Run a scenario to completion and return its validated facts.
   *
   * `structuredResult` is typed `unknown` on purpose — a provider is untrusted —
   * so the test validates it the same way the service does instead of reaching
   * into it. The call id carries its own start time, so rewinding that time is
   * all it takes to reach the finished state without waiting.
   */
  async function factsFor(demoScenario: string, demoContext: DemoContext) {
    const provider = new MockPhoneVerificationProvider();
    const session = await provider.initiateCall({ ...input, demoScenario, demoContext });

    const decoded = JSON.parse(
      Buffer.from(session.callId.slice(5), "base64url").toString("utf8"),
    ) as { t: number };
    const finished =
      "mock_" +
      Buffer.from(JSON.stringify({ ...decoded, t: decoded.t - 60_000 }), "utf8").toString(
        "base64url",
      );

    const result = await provider.getCallResult(finished);
    const parsed = callVerificationResultSchema.safeParse(result.structuredResult);
    if (!parsed.success) {
      throw new Error(
        "simulated facts failed their own schema: " + parsed.error.issues[0]?.message,
      );
    }
    return { facts: parsed.data, result };
  }

  it("quotes a plausible increased rent on a four-figure listing", async () => {
    const { facts } = await factsFor("price_mismatch", euroContext);

    // EUR 1,650/month is 19,800 a year; the scenario raises it by about a third.
    expect(facts.current_rent).toBeGreaterThan(19_800);
    expect(facts.current_rent).toBeLessThan(30_000);
  });

  it("never collapses a derived fee to zero", async () => {
    const { facts } = await factsFor("clean", euroContext);

    expect(facts.service_charge).toBeGreaterThan(0);
    expect(facts.agency_fee).toBeGreaterThan(0);
    expect(facts.legal_fee).toBeGreaterThan(0);
    expect(facts.caution_fee).toBeGreaterThan(0);
  });

  it("still speaks in whole millions for a listing quoted in millions", async () => {
    const { facts } = await factsFor("price_mismatch", {
      ...euroContext,
      rent: 7_500_000,
      currency: "NGN",
      rentPeriod: "yearly",
    });

    expect(facts.current_rent).toBeGreaterThan(7_500_000);
    expect(facts.current_rent).toBeLessThan(12_000_000);
  });

  it("keeps the simulated conversation free of market-specific idiom", async () => {
    const { result } = await factsFor("clean", euroContext);
    const spokenText = result.transcript.map((turn) => turn.text).join(" ").toLowerCase();

    // These read as errors on a Lisbon or an Austin listing.
    for (const term of ["borehole", "compound", "caution deposit"]) {
      expect(spokenText, "found \"" + term + "\" in the transcript").not.toContain(term);
    }
  });
});
