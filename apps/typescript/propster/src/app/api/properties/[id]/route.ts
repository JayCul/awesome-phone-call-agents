import { handleRoute, jsonOk } from "@/server/http";
import { getPropertyDetail } from "@/server/readModel";

export const dynamic = "force-dynamic";

/** GET /api/properties/:id?searchId=... */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleRoute("GET /api/properties/:id", async () => {
    const { id } = await context.params;
    const searchId = new URL(request.url).searchParams.get("searchId") ?? undefined;
    return jsonOk(await getPropertyDetail(id, searchId));
  });
}
