import { searchRequestSchema } from "@/domain/schemas";
import { ApiError, handleRoute, jsonOk, parseJsonBody } from "@/server/http";
import { callerIdentity, enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import {
  extractRequirement,
  mergeRequirements,
} from "@/server/requirements/extractor";
import { runSearch } from "@/server/search/searchService";

export const dynamic = "force-dynamic";

/**
 * POST /api/search
 *
 * Accepts natural language, structured fields, or both. Structured fields win
 * over anything inferred from prose.
 */
export async function POST(request: Request) {
  return handleRoute("POST /api/search", async () => {
    enforceRateLimit("search", callerIdentity(request), RATE_LIMITS.search);

    const body = await parseJsonBody(request, searchRequestSchema);

    let extracted = null;
    let source: "model" | "rules" = "rules";

    if (body.naturalLanguage) {
      const outcome = await extractRequirement(body.naturalLanguage);
      if (outcome) {
        extracted = outcome.requirement;
        source = outcome.source;
      }
    }

    const requirement = mergeRequirements(extracted, body.structured);

    if (!requirement) {
      throw ApiError.badRequest(
        "Could not understand the requirement",
        "Tell us which area you are looking in, for example \"3 bedroom flat in Lekki under 8 million\".",
      );
    }

    const result = await runSearch(requirement, {
      rawQuery: body.naturalLanguage,
      source,
    });

    return jsonOk({
      searchId: result.searchId,
      found: result.found,
      candidates: result.candidates,
      requirement,
      extractionSource: source,
    });
  });
}
