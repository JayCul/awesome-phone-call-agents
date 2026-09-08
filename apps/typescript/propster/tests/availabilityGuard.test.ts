import { describe, expect, it } from "vitest";
import { guardAvailabilityClaim } from "@/server/verification/transcriptExtractor";
import type { CallVerificationResult } from "@/domain/schemas";
import type { TranscriptTurn } from "@/domain/types";

/**
 * Taken verbatim from a real CALL-E call (call_6s6e8YWADW869hi1qPT3kg) to the
 * official US test hotline. The contact never says the property has gone — they
 * say they have no information about it. The extraction model nevertheless
 * returned `property_available: false`, and Propster told the user "the contact
 * said this property is no longer on the market", which nobody had said.
 */
const COULD_NOT_HELP: TranscriptTurn[] = [
  { offsetSeconds: 3, speaker: "contact", text: "Thanks for calling. How can I help you today?" },
  { offsetSeconds: 12, speaker: "contact", text: "What would you like me to verify?" },
  {
    offsetSeconds: 29,
    speaker: "contact",
    text:
      "What would you like me to verify? I don't have information about apartment availability. " +
      "So I can't verify that for you. I'm sorry. I can't help further. Thank you for calling. Goodbye.",
  },
];

const claimsUnavailable: CallVerificationResult = {
  reached_contact: true,
  property_available: false,
} as CallVerificationResult;

describe("guardAvailabilityClaim", () => {
  it("drops a 'no longer available' the contact never said", () => {
    const guarded = guardAvailabilityClaim(claimsUnavailable, COULD_NOT_HELP);
    expect(guarded.property_available).toBeNull();
  });

  it("keeps it when the contact really does say the property has gone", () => {
    const turns: TranscriptTurn[] = [
      {
        offsetSeconds: 20,
        speaker: "contact",
        text: "No, sorry. That one has gone. We let it about two weeks ago.",
      },
    ];
    expect(guardAvailabilityClaim(claimsUnavailable, turns).property_available).toBe(false);
  });

  it.each([
    "It is no longer available, I'm afraid.",
    "That flat has been rented already.",
    "We took it off the market last week.",
    "Sorry, it's gone.",
  ])("recognises a genuine refusal: %s", (text) => {
    const turns: TranscriptTurn[] = [{ offsetSeconds: 10, speaker: "contact", text }];
    expect(guardAvailabilityClaim(claimsUnavailable, turns).property_available).toBe(false);
  });

  it.each([
    "I don't know, I would have to check with the agent.",
    "I'm not the right person for that, call the office.",
    "I can't confirm that today.",
  ])("treats not knowing as unconfirmed, not as a no: %s", (text) => {
    const turns: TranscriptTurn[] = [{ offsetSeconds: 10, speaker: "contact", text }];
    expect(guardAvailabilityClaim(claimsUnavailable, turns).property_available).toBeNull();
  });

  it("never upgrades: a confirmed available stays available", () => {
    const available = { reached_contact: true, property_available: true } as CallVerificationResult;
    const guarded = guardAvailabilityClaim(available, COULD_NOT_HELP);
    expect(guarded.property_available).toBe(true);
  });

  it("leaves an unconfirmed availability alone", () => {
    const unknown = { reached_contact: true, property_available: null } as CallVerificationResult;
    expect(guardAvailabilityClaim(unknown, COULD_NOT_HELP).property_available).toBeNull();
  });

  it("ignores the agent's own words when judging what the contact said", () => {
    const turns: TranscriptTurn[] = [
      { offsetSeconds: 5, speaker: "agent", text: "Has the property been let or is it no longer available?" },
      { offsetSeconds: 9, speaker: "contact", text: "Hmm, I would have to look into that for you." },
    ];
    expect(guardAvailabilityClaim(claimsUnavailable, turns).property_available).toBeNull();
  });
});
