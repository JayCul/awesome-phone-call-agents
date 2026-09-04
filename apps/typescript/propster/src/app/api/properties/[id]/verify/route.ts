import { verifyRequestSchema } from "@/domain/schemas";
import { handleRoute, jsonOk, parseJsonBody } from "@/server/http";
import { callerIdentity, enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import { requirementOf } from "@/server/readModel";
import { requireSearch } from "@/server/search/searchService";
import { startVerification } from "@/server/verification/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/properties/:id/verify
 *
 * Places the verification call. Rate limited hard: this rings a real person.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleRoute("POST /api/properties/:id/verify", async () => {
    enforceRateLimit("verify", callerIdentity(request), RATE_LIMITS.verify);

    const { id } = await context.params;
    const body = await parseJsonBody(request, verifyRequestSchema);
    const search = await requireSearch(body.searchId);

    const result = await startVerification({
      propertyId: id,
      searchId: search.id,
      requirement: requirementOf(search),
    });

    return jsonOk(result);
  });
}
