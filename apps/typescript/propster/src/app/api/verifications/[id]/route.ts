import { handleRoute, jsonOk, ApiError } from "@/server/http";
import { prisma } from "@/server/db";
import { getPropertyDetail } from "@/server/readModel";

export const dynamic = "force-dynamic";

/** GET /api/verifications/:id — the full verification record. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleRoute("GET /api/verifications/:id", async () => {
    const { id } = await context.params;
    const verification = await prisma.propertyVerification.findUnique({
      where: { id },
      select: { propertyId: true, searchId: true },
    });
    if (!verification) throw ApiError.notFound("That verification does not exist.");
    return jsonOk(await getPropertyDetail(verification.propertyId, verification.searchId));
  });
}
