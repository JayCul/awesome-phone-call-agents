import { PrismaClient } from "@prisma/client";
import { SEED_PROPERTIES } from "./seed-data";

const prisma = new PrismaClient();

async function main() {
  // Reset only the demo corpus. Properties submitted through /try carry
  // source "user" and are left alone, so reseeding before a demo can never
  // delete a judge's test listing (or the phone number attached to it).
  await prisma.searchCandidate.deleteMany();
  await prisma.search.deleteMany();
  await prisma.property.deleteMany({ where: { source: "seed" } });

  for (const property of SEED_PROPERTIES) {
    await prisma.property.create({
      data: {
        title: property.title,
        description: property.description,
        location: property.location,
        area: property.area,
        country: property.country,
        propertyType: property.propertyType,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        rent: property.rent,
        currency: property.currency,
        rentPeriod: property.rentPeriod,
        amenities: JSON.stringify(property.amenities),
        imageUrl: property.imageUrl,
        sourceUrl: property.sourceUrl,
        agentName: property.agentName,
        agentPhone: property.agentPhone,
        listedAt: property.listedAt,
        demoScenario: property.demoScenario,
        source: "seed",
        verificationStatus: "unverified",
      },
    });
  }

  const seeded = await prisma.property.count({ where: { source: "seed" } });
  const submitted = await prisma.property.count({ where: { source: "user" } });
  console.log("Seeded " + seeded + " demo listings.");
  if (submitted > 0) console.log("Preserved " + submitted + " submitted test listing(s).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
