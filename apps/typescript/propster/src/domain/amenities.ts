/**
 * Amenity vocabulary. Users type "prepaid meter", listings say "Prepaid
 * Electricity Meter" and a phone agent says "yes it's on prepaid". All three
 * have to collapse onto one canonical key before anything can be compared.
 */

export type AmenityKey =
  | "parking"
  | "air_conditioning"
  | "heating"
  | "elevator"
  | "balcony"
  | "furnished"
  | "laundry"
  | "dishwasher"
  | "internet"
  | "security"
  | "backup_power"
  | "water"
  | "prepaid_meter"
  | "gym"
  | "pool"
  | "concierge"
  | "pets";

interface AmenityDefinition {
  key: AmenityKey;
  label: string;
  /** Lowercased substrings that imply this amenity. */
  synonyms: string[];
}

/**
 * The vocabulary is deliberately international.
 *
 * Renters describe the same thing differently depending on where they are: a
 * backup generator in Lagos, a load-shedding inverter in Cape Town and a
 * standby supply in Mumbai are one amenity. A prepaid meter matters in some
 * markets and is meaningless in others, so it stays in the list but is not
 * treated as universal. Everything collapses onto one canonical key before
 * anything is compared, because a discrepancy between "AC" and "air
 * conditioning" is not a discrepancy.
 */
const DEFINITIONS: AmenityDefinition[] = [
  {
    key: "parking",
    label: "Parking",
    synonyms: [
      "parking",
      "car park",
      "carport",
      "garage",
      "parking space",
      "parking bay",
      "car park lot",
      "off-street parking",
    ],
  },
  {
    key: "air_conditioning",
    label: "Air conditioning",
    synonyms: ["air conditioning", "air-conditioning", "air con", "aircon", "ac", "a/c", "split unit", "chiller"],
  },
  {
    key: "heating",
    label: "Heating",
    synonyms: ["heating", "central heating", "gas heating", "radiator", "boiler", "underfloor"],
  },
  { key: "elevator", label: "Elevator", synonyms: ["elevator", "lift"] },
  { key: "balcony", label: "Balcony", synonyms: ["balcony", "terrace", "patio", "roof terrace"] },
  {
    key: "furnished",
    label: "Furnished",
    synonyms: ["furnished", "fully furnished", "semi furnished", "part furnished"],
  },
  {
    key: "laundry",
    label: "Laundry",
    synonyms: ["laundry", "washer", "washing machine", "in-unit laundry", "dryer"],
  },
  { key: "dishwasher", label: "Dishwasher", synonyms: ["dishwasher"] },
  {
    key: "internet",
    label: "Fibre internet",
    synonyms: ["internet", "fibre", "fiber", "broadband", "wifi", "wi-fi"],
  },
  {
    key: "security",
    label: "Security",
    synonyms: ["security", "gated", "guard", "cctv", "estate security", "doorman", "secure entry"],
  },
  {
    key: "backup_power",
    label: "Backup power",
    synonyms: [
      "backup power",
      "back-up power",
      "generator",
      "standby generator",
      "inverter",
      "power backup",
      "load shedding",
      "ups",
    ],
  },
  {
    key: "water",
    label: "Water supply",
    synonyms: ["borehole", "water supply", "treated water", "well", "water tank"],
  },
  {
    key: "prepaid_meter",
    label: "Prepaid meter",
    synonyms: ["prepaid", "pre-paid", "prepaid meter", "prepaid electricity", "prepayment meter"],
  },
  { key: "gym", label: "Gym", synonyms: ["gym", "fitness", "fitness centre", "fitness center"] },
  { key: "pool", label: "Swimming pool", synonyms: ["pool", "swimming"] },
  {
    key: "concierge",
    label: "Concierge",
    synonyms: ["concierge", "serviced", "facility management", "porter", "front desk"],
  },
  { key: "pets", label: "Pets allowed", synonyms: ["pet", "pets", "dog", "cat", "pet friendly"] },
];

const BY_KEY = new Map(DEFINITIONS.map((d) => [d.key, d]));

/** Map a free-text amenity phrase onto a canonical key, or null if unknown. */
export function canonicalizeAmenity(raw: string): AmenityKey | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;

  // Longest synonym first so "prepaid meter" beats a bare "meter".
  let best: { key: AmenityKey; length: number } | null = null;
  for (const def of DEFINITIONS) {
    for (const synonym of def.synonyms) {
      const matches = text === synonym || text.includes(synonym);
      if (matches && (!best || synonym.length > best.length)) {
        best = { key: def.key, length: synonym.length };
      }
    }
  }
  return best?.key ?? null;
}

export function canonicalizeAmenities(list: readonly string[]): AmenityKey[] {
  const seen = new Set<AmenityKey>();
  for (const item of list) {
    const key = canonicalizeAmenity(item);
    if (key) seen.add(key);
  }
  return [...seen];
}

export function amenityLabel(key: AmenityKey): string {
  return BY_KEY.get(key)?.label ?? key;
}

/**
 * Read the verified value of one amenity out of the structured call result.
 * `undefined` means the call never established it — which is different from
 * `false`, and the scoring treats it differently.
 */
export function verifiedAmenityValue(
  key: AmenityKey,
  verified: {
    parkingAvailable?: boolean;
    securityAvailable?: boolean;
    generatorAvailable?: boolean;
    internetAvailable?: boolean;
    airConditioning?: boolean;
    furnished?: boolean;
    petsAllowed?: boolean;
    electricityType?: string;
    waterSupply?: string;
  },
): boolean | undefined {
  switch (key) {
    case "parking":
      return verified.parkingAvailable;
    case "security":
      return verified.securityAvailable;
    case "backup_power":
      return verified.generatorAvailable;
    case "internet":
      return verified.internetAvailable;
    case "air_conditioning":
      return verified.airConditioning;
    case "furnished":
      return verified.furnished;
    case "pets":
      return verified.petsAllowed;
    case "prepaid_meter":
      if (verified.electricityType === undefined) return undefined;
      return /prepaid|pre-paid|pre paid|prepayment/i.test(verified.electricityType);
    case "water":
      if (verified.waterSupply === undefined) return undefined;
      return verified.waterSupply.trim().length > 0;
    default:
      // Amenities the call script does not probe. Unknown is not the same as
      // absent, and the score treats them differently.
      return undefined;
  }
}
