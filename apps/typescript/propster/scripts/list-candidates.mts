/**
 * Developer helper: print the verification candidates for the latest search,
 * with the demo scenario each one will replay in demo mode.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const search = await prisma.search.findFirst({ orderBy: { createdAt: "desc" } });
if (!search) {
  console.log("No searches yet. Run one at http://localhost:3100/search");
} else {
  const candidates = await prisma.searchCandidate.findMany({
    where: { searchId: search.id, isCandidate: true },
    include: { property: true },
    orderBy: { matchScore: "desc" },
  });
  console.log("SEARCH=" + search.id);
  for (const candidate of candidates) {
    console.log(
      candidate.propertyId +
        " | " +
        candidate.property.demoScenario.padEnd(16) +
        " | " +
        candidate.property.title,
    );
  }
}
await prisma.$disconnect();
