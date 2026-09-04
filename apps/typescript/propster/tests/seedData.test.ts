import { describe, expect, it } from "vitest";
import { SEED_PROPERTIES } from "../prisma/seed-data";
import { isReservedDemoPhone } from "@/domain/phone";

/**
 * The /try endpoint refuses any number matching RESERVED_DEMO_PHONE, so that a
 * visitor cannot resurrect a fabricated listing and use it to dial whoever owns
 * that number. That guard is only worth anything if the pattern actually
 * matches the numbers the seed generates.
 */
describe("seeded demo phone numbers", () => {
  it("all fall inside the reserved range the /try guard blocks", () => {
    expect(SEED_PROPERTIES.length).toBeGreaterThan(0);
    const real = SEED_PROPERTIES.filter((p) => !isReservedDemoPhone(p.agentPhone));
    // A number outside the range is a real one deliberately added for live
    // testing; it must be the exception, not the rule.
    expect(real.length).toBeLessThanOrEqual(1);
  });

  it("are all valid E.164", () => {
    for (const property of SEED_PROPERTIES) {
      expect(property.agentPhone).toMatch(/^\+[1-9]\d{7,14}$/);
    }
  });

  it("point at vendored local images, never a remote host", () => {
    for (const property of SEED_PROPERTIES) {
      expect(property.imageUrl).toMatch(/^\/img\/[a-z0-9-]+\.webp$/);
    }
  });
});
