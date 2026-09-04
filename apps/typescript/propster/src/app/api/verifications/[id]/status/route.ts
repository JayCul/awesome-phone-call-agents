import { handleRoute, jsonOk } from "@/server/http";
import { refreshVerification } from "@/server/verification/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/verifications/:id/status
 *
 * Polled by the live activity panel. Each call advances the state machine by
 * asking the provider where the call has got to, then returns the snapshot.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleRoute("GET /api/verifications/:id/status", async () => {
    const { id } = await context.params;
    return jsonOk(await refreshVerification(id));
  });
}
