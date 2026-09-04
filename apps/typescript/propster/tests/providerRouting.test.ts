import { describe, expect, it } from "vitest";
import { isReservedDemoPhone, reservedRangeAuthority } from "@/domain/phone";
import { SEED_PROPERTIES } from "../prisma/seed-data";

/**
 * Which provider handles a listing decides whether a real telephone rings.
 *
 * Seeded listings carry fictional numbers and must be simulated: dialling one
 * spends call credits to reach nobody, and because the range is syntactically
 * valid it could reach whoever genuinely owns that number. A listing submitted
 * through /try carries its owner's real number and explicit consent, and must
 * get a real call — that is the whole point of the page.
 */
describe("provider routing by phone number", () => {
  it("classifies every fictional seeded number as simulate-only", () => {
    const fictional = SEED_PROPERTIES.filter((p) => isReservedDemoPhone(p.agentPhone));
    // All but the one deliberately-real demo listing.
    expect(fictional.length).toBeGreaterThanOrEqual(SEED_PROPERTIES.length - 1);
  });

  it("does not classify an ordinary Nigerian mobile as fictional", () => {
    // Numbers a visitor would plausibly enter on /try. Both are fabricated for
    // this test: never put a real subscriber's number in the repository.
    expect(isReservedDemoPhone("+2348012345678")).toBe(false);
    expect(isReservedDemoPhone("+2349011122233")).toBe(false);
  });

  it("matches the whole reserved block and nothing adjacent to it", () => {
    expect(isReservedDemoPhone("+2347000000001")).toBe(true);
    expect(isReservedDemoPhone("+2347000000014")).toBe(true);
    // One digit longer or shorter must not be swept in.
    expect(isReservedDemoPhone("+23470000000011")).toBe(false);
    expect(isReservedDemoPhone("+234700000001")).toBe(false);
  });
});
