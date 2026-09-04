import { testPropertySchema } from "@/domain/schemas";
import { isReservedDemoPhone } from "@/domain/phone";
import { marketDefaults } from "@/domain/money";
import { prisma } from "@/server/db";
import { ApiError, handleRoute, jsonOk, parseJsonBody } from "@/server/http";
import { logger } from "@/server/logger";
import { callerIdentity, enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import { matchRequirements } from "@/domain/matching";
import { toListing } from "@/server/search/mockProvider";

export const dynamic = "force-dynamic";

/**
 * POST /api/test-properties
 *
 * Creates a one-off listing from a visitor's own details so they can watch
 * Propster verify it against their own phone. This is the "try it on something
 * real" path used at demos.
 *
 * This endpoint causes a real telephone call to a number a stranger typed, so
 * it is the most abusable surface in the application. It is constrained by:
 *
 *  - an explicit consent flag the submitter must set, asserting the number is
 *    theirs (recorded as `consentedAt` on the row);
 *  - E.164 validation, and a rejection of the fabricated seed range;
 *  - a hard per-caller rate limit, tighter than search;
 *  - `source: "user"`, so the row is visible as visitor-submitted and is never
 *    removed by reseeding.
 *
 * The call itself is still a separate, deliberate action: this only creates the
 * listing and the search. Nothing is dialled until the visitor clicks verify.
 */
export async function POST(request: Request) {
  return handleRoute("POST /api/test-properties", async () => {
    enforceRateLimit("testProperty", callerIdentity(request), RATE_LIMITS.testProperty);

    const body = await parseJsonBody(request, testPropertySchema);

    if (!body.consent) {
      throw ApiError.badRequest(
        "Consent was not given",
        "Confirm the number is yours and that you agree to receive an automated call.",
      );
    }

    // The seeded demo numbers are fictional. Refusing them here stops someone
    // resurrecting a fake listing through this form to dial a stranger.
    if (isReservedDemoPhone(body.agentPhone)) {
      throw ApiError.badRequest(
        "Reserved demo number",
        "That number is from a range reserved for fiction and cannot be called. Use your own number.",
      );
    }

    const property = await prisma.property.create({
      data: {
        title: body.title,
        description:
          body.description ??
          "Submitted for a live verification test. Propster will call the number given and ask about this listing.",
        location: body.country ? body.area + ", " + body.country : body.area,
        area: body.area,
        propertyType: body.propertyType,
        bedrooms: body.bedrooms,
        bathrooms: body.bathrooms ?? null,
        rent: body.rent,
        currency: body.currency,
        rentPeriod: body.rentPeriod,
        amenities: JSON.stringify(body.amenities),
        country: body.country ?? null,
        imageUrl: "/img/property-04.webp",
        agentName: body.agentName ?? "Test contact",
        agentPhone: body.agentPhone,
        listedAt: new Date().toISOString().slice(0, 10),
        // A live call is the whole point here, so the deterministic provider
        // should behave as an ordinary clean conversation if demo mode is on.
        demoScenario: "clean",
        source: "user",
        consentedAt: new Date(),
        submittedBy: body.agentName ?? null,
        verificationStatus: "unverified",
      },
    });

    // Build a search around the listing's own attributes, so the call objective
    // asks about the things the submitter said the property has.
    const search = await prisma.search.create({
      data: {
        rawQuery: null,
        extractionSource: "rules",
        location: body.area,
        propertyType: body.propertyType,
        bedrooms: body.bedrooms,
        bathrooms: body.bathrooms ?? null,
        maxRent: body.rent,
        currency: body.currency,
        rentPeriod: body.rentPeriod,
        amenities: JSON.stringify(body.amenities),
        additionalRequirements: JSON.stringify([]),
      },
    });

    const listing = toListing(property);
    const match = matchRequirements(listing, {
      location: body.area,
      propertyType: body.propertyType,
      bedrooms: body.bedrooms,
      maxRent: body.rent,
      currency: body.currency,
      rentPeriod: body.rentPeriod,
      amenities: body.amenities,
      additionalRequirements: [],
    });

    await prisma.searchCandidate.create({
      data: {
        searchId: search.id,
        propertyId: property.id,
        matchScore: match.score,
        matchNotes: JSON.stringify({ reasons: match.reasons, misses: match.misses }),
        isCandidate: true,
      },
    });

    // The phone number is deliberately absent from this log line; `logger`
    // redacts it anyway, but it should not be constructed here at all.
    logger.info("test_property.created", {
      propertyId: property.id,
      searchId: search.id,
      area: body.area,
    });

    return jsonOk({
      propertyId: property.id,
      searchId: search.id,
      verifyUrl: "/property/" + property.id + "?searchId=" + search.id,
    });
  });
}
