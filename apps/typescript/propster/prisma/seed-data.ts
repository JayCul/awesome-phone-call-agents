/**
 * Demo listing corpus for Propster.
 *
 * These listings are FICTIONAL, but not invented. Each one is modelled on a
 * real neighbourhood, at a rent that reflects what that market actually
 * charges, with the amenities and fee structures renters there genuinely
 * encounter. Sources for the rent levels are recorded in `docs/market-data.md`.
 *
 * What is deliberately NOT real:
 *
 *  - The properties. None of these is a live listing, and none is scraped from
 *    a portal. Copying real listings would breach those sites' terms, and the
 *    photographs and addresses would belong to someone else.
 *  - The contacts. Every phone number comes from a range a national regulator
 *    has reserved for drama and documentation, so none of them can reach a
 *    person. Names are invented.
 *
 * That combination is the point: the numbers are realistic enough that the
 * verification results mean something, and nothing here can put a real agent's
 * phone on the end of an automated call.
 *
 * The corpus is international. Propster is not a product for one city: the same
 * workflow applies wherever a listing makes a claim somebody ought to check.
 * Each listing carries its own currency and rent period, because markets differ
 * on both — Dubai quotes a year, Lisbon quotes a month — and nothing in the
 * product converts between them.
 *
 * Lisbon carries several listings so the demo search returns a full spread of
 * outcomes; the rest are spread across other markets.
 *
 * `demoScenario` drives the deterministic mock phone provider only. When a real
 * CALL-E key is configured, the live conversation is the only source of
 * verified facts and this field is ignored.
 */
import { demoPhone } from "../src/domain/phone";
import type { Currency } from "../src/domain/money";

export type DemoScenario =
  | "clean"
  | "price_mismatch"
  | "amenity_missing"
  | "unavailable"
  | "partial"
  | "no_answer";

export interface SeedProperty {
  title: string;
  description: string;
  location: string;
  area: string;
  country: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  rent: number;
  currency: Currency;
  rentPeriod: "monthly" | "yearly";
  amenities: string[];
  imageUrl: string;
  sourceUrl: string;
  agentName: string;
  agentPhone: string;
  listedAt: string;
  demoScenario: DemoScenario;
}

/**
 * The one listing that may be dialled for real, read from the environment.
 *
 * A live number must never be committed: this file is part of a public
 * submission. Set DEMO_AGENT_PHONE in .env to the number that should receive
 * demo calls. Without it the listing keeps a reserved fictional number and
 * simply cannot be called, which is the safe default.
 */
const LIVE_DEMO_PHONE = process.env.DEMO_AGENT_PHONE?.trim() || demoPhone(1);

const photo = (name: string) => "/img/" + name + ".webp";

export const SEED_PROPERTIES: SeedProperty[] = [
  // --- Lisbon ---------------------------------------------------------------
  // Central two-beds run roughly EUR 1,800-3,500 with a median near 1,900.
  {
    title: "2 Bedroom Apartment, Príncipe Real",
    description:
      "Second-floor two bedroom on a quiet street behind the Jardim do Príncipe Real. Renovated kitchen, original hardwood floors, double glazing to the front, and air conditioning in both bedrooms. One parking space in the building garage. Condomínio charge included in the rent.",
    location: "Príncipe Real, Lisbon",
    area: "Príncipe Real",
    country: "Portugal",
    propertyType: "apartment",
    bedrooms: 2,
    bathrooms: 2,
    rent: 2_100,
    currency: "EUR",
    rentPeriod: "monthly",
    amenities: ["Parking", "Air conditioning", "Elevator", "Balcony", "Fibre internet"],
    imageUrl: photo("interior"),
    sourceUrl: "https://example.com/listings/lisbon-principe-real-2bed",
    agentName: "Inês Carvalho (demo contact)",
    agentPhone: LIVE_DEMO_PHONE,
    listedAt: "2026-08-14",
    demoScenario: "clean",
  },
  {
    title: "2 Bedroom Apartment, Campo de Ourique",
    description:
      "Bright two bedroom a short walk from the Mercado de Campo de Ourique. Lift, private storage in the basement, underground parking, and split-unit air conditioning in the living room. Building has a resident caretaker.",
    location: "Campo de Ourique, Lisbon",
    area: "Campo de Ourique",
    country: "Portugal",
    propertyType: "apartment",
    bedrooms: 2,
    bathrooms: 2,
    rent: 1_950,
    currency: "EUR",
    rentPeriod: "monthly",
    amenities: ["Parking", "Air conditioning", "Elevator", "Concierge"],
    imageUrl: photo("doubt"),
    sourceUrl: "https://example.com/listings/lisbon-campo-de-ourique-2bed",
    agentName: "Rui Almeida (demo contact)",
    agentPhone: demoPhone(4),
    listedAt: "2026-07-30",
    demoScenario: "unavailable",
  },
  {
    title: "2 Bedroom Apartment, Graça",
    description:
      "Top floor two bedroom in Graça with a west-facing terrace and rooftop views toward the river. Fitted wardrobes, air conditioning, and a dedicated parking bay in the interior courtyard. Four flights, no lift.",
    location: "Graça, Lisbon",
    area: "Graça",
    country: "Portugal",
    propertyType: "apartment",
    bedrooms: 2,
    bathrooms: 1,
    rent: 1_780,
    currency: "EUR",
    rentPeriod: "monthly",
    amenities: ["Parking", "Air conditioning", "Balcony", "Heating"],
    imageUrl: photo("flat-balcony"),
    sourceUrl: "https://example.com/listings/lisbon-graca-2bed",
    agentName: "Marta Sousa (demo contact)",
    agentPhone: demoPhone(3),
    listedAt: "2026-08-09",
    demoScenario: "amenity_missing",
  },
  {
    title: "2 Bedroom Apartment, Alcântara",
    description:
      "Two bedroom in a converted riverside warehouse at Alcântara, near the LX Factory. Open plan living, lift access, resident parking, and fibre already installed. Gas central heating throughout.",
    location: "Alcântara, Lisbon",
    area: "Alcântara",
    country: "Portugal",
    propertyType: "apartment",
    bedrooms: 2,
    bathrooms: 1,
    rent: 1_720,
    currency: "EUR",
    rentPeriod: "monthly",
    amenities: ["Parking", "Elevator", "Fibre internet", "Heating"],
    imageUrl: photo("flat-bright"),
    sourceUrl: "https://example.com/listings/lisbon-alcantara-2bed",
    agentName: "Tiago Ferreira (demo contact)",
    agentPhone: demoPhone(2),
    listedAt: "2026-08-21",
    demoScenario: "price_mismatch",
  },
  {
    title: "2 Bedroom Apartment, Arroios",
    description:
      "Refurbished two bedroom in Arroios, three minutes from the Alameda metro. New boiler, air conditioning in the main room, shared interior courtyard, and one parking space on the ground floor.",
    location: "Arroios, Lisbon",
    area: "Arroios",
    country: "Portugal",
    propertyType: "apartment",
    bedrooms: 2,
    bathrooms: 1,
    rent: 1_650,
    currency: "EUR",
    rentPeriod: "monthly",
    amenities: ["Parking", "Air conditioning", "Heating", "Fibre internet"],
    imageUrl: photo("block-balconies"),
    sourceUrl: "https://example.com/listings/lisbon-arroios-2bed",
    agentName: "Beatriz Lopes (demo contact)",
    agentPhone: demoPhone(5),
    listedAt: "2026-08-25",
    demoScenario: "partial",
  },
  {
    title: "3 Bedroom Apartment, Belém",
    description:
      "Three bedroom over two floors near the Belém waterfront. Two bathrooms, lift to the lower level, garage parking for one car, air conditioning, and a south-facing balcony off the living room.",
    location: "Belém, Lisbon",
    area: "Belém",
    country: "Portugal",
    propertyType: "apartment",
    bedrooms: 3,
    bathrooms: 2,
    rent: 2_650,
    currency: "EUR",
    rentPeriod: "monthly",
    amenities: ["Parking", "Air conditioning", "Elevator", "Balcony", "Gym"],
    imageUrl: photo("flat-stairwell"),
    sourceUrl: "https://example.com/listings/lisbon-belem-3bed",
    agentName: "Nuno Pinto (demo contact)",
    agentPhone: demoPhone(6),
    listedAt: "2026-08-18",
    demoScenario: "no_answer",
  },

  // --- Elsewhere ------------------------------------------------------------
  {
    title: "1 Bedroom Loft, East Austin",
    description:
      "Converted warehouse loft east of I-35, ten minutes from downtown Austin. Exposed brick, in-unit washer and dryer, one assigned covered parking space, central air, and a rooftop shared between four units.",
    location: "East Austin, Texas",
    area: "East Austin",
    country: "United States",
    propertyType: "apartment",
    bedrooms: 1,
    bathrooms: 1,
    rent: 2_050,
    currency: "USD",
    rentPeriod: "monthly",
    amenities: ["Parking", "Air conditioning", "Laundry", "Fibre internet"],
    imageUrl: photo("flat-brick"),
    sourceUrl: "https://example.com/listings/austin-east-loft",
    agentName: "Dana Whitfield (demo contact)",
    agentPhone: demoPhone(7),
    listedAt: "2026-08-27",
    demoScenario: "clean",
  },
  {
    title: "2 Bedroom Flat, London Fields",
    description:
      "Two bedroom first-floor flat overlooking London Fields, Hackney. Gas central heating, sash windows, secure bike store in the rear yard, communal garden, and full fibre to the property. No parking; controlled parking zone permits available from the council.",
    location: "Hackney, London",
    area: "Hackney",
    country: "United Kingdom",
    propertyType: "apartment",
    bedrooms: 2,
    bathrooms: 1,
    rent: 2_550,
    currency: "GBP",
    rentPeriod: "monthly",
    amenities: ["Heating", "Fibre internet", "Balcony"],
    imageUrl: photo("flat-modern"),
    sourceUrl: "https://example.com/listings/london-hackney-2bed",
    agentName: "Owen Blackwood (demo contact)",
    agentPhone: demoPhone(8),
    listedAt: "2026-08-11",
    demoScenario: "price_mismatch",
  },
  {
    title: "3 Bedroom Apartment, Jumeirah Lake Towers",
    description:
      "Three bedroom on a high floor at JLT with lake views and a maid's room. Chiller charges included, one covered parking bay, gym and pool in the tower, and 24 hour concierge. Rent quoted annually and payable in up to four cheques.",
    location: "Jumeirah Lake Towers, Dubai",
    area: "Jumeirah Lake Towers",
    country: "United Arab Emirates",
    propertyType: "apartment",
    bedrooms: 3,
    bathrooms: 3,
    rent: 185_000,
    currency: "AED",
    rentPeriod: "yearly",
    amenities: ["Parking", "Air conditioning", "Gym", "Swimming pool", "Concierge", "Elevator"],
    imageUrl: photo("tower-city"),
    sourceUrl: "https://example.com/listings/dubai-jlt-3bed",
    agentName: "Layla Haddad (demo contact)",
    agentPhone: demoPhone(9),
    listedAt: "2026-07-22",
    demoScenario: "clean",
  },
  {
    title: "2 Bedroom Altbau, Prenzlauer Berg",
    description:
      "Classic Altbau two bedroom off Kollwitzplatz with 3.4 metre ceilings and original herringbone parquet. Balcony to the rear courtyard, cellar storage, central heating, and fibre available in the building. Kaltmiete; Nebenkosten billed separately.",
    location: "Prenzlauer Berg, Berlin",
    area: "Prenzlauer Berg",
    country: "Germany",
    propertyType: "apartment",
    bedrooms: 2,
    bathrooms: 1,
    rent: 1_720,
    currency: "EUR",
    rentPeriod: "monthly",
    amenities: ["Heating", "Balcony", "Fibre internet", "Elevator"],
    imageUrl: photo("flat-parquet"),
    sourceUrl: "https://example.com/listings/berlin-prenzlauer-berg-2bed",
    agentName: "Katrin Vogel (demo contact)",
    agentPhone: demoPhone(10),
    listedAt: "2026-08-05",
    demoScenario: "partial",
  },
  {
    title: "2 Bedroom Apartment, Sea Point",
    description:
      "Two bedroom a block back from the Sea Point promenade. Secure basement parking bay, building backup power for load shedding, fibre installed, and 24 hour security at the entrance. Levy included in the rent.",
    location: "Sea Point, Cape Town",
    area: "Sea Point",
    country: "South Africa",
    propertyType: "apartment",
    bedrooms: 2,
    bathrooms: 2,
    rent: 26_500,
    currency: "ZAR",
    rentPeriod: "monthly",
    amenities: ["Parking", "Security", "Backup power", "Fibre internet", "Elevator"],
    imageUrl: photo("coastal-view"),
    sourceUrl: "https://example.com/listings/cape-town-sea-point-2bed",
    agentName: "Thandi Mokoena (demo contact)",
    agentPhone: demoPhone(11),
    listedAt: "2026-08-23",
    demoScenario: "amenity_missing",
  },
  {
    title: "3 Bedroom Condo, Tiong Bahru",
    description:
      "Three bedroom in a low-rise development in Tiong Bahru, eight minutes' walk to the MRT. Air conditioning in every room, one car park lot, lap pool and gym in the development, and a resident manager on site.",
    location: "Tiong Bahru, Singapore",
    area: "Tiong Bahru",
    country: "Singapore",
    propertyType: "apartment",
    bedrooms: 3,
    bathrooms: 2,
    rent: 6_200,
    currency: "SGD",
    rentPeriod: "monthly",
    amenities: ["Parking", "Air conditioning", "Swimming pool", "Gym", "Security"],
    imageUrl: photo("courtyard-tropical"),
    sourceUrl: "https://example.com/listings/singapore-tiong-bahru-3bed",
    agentName: "Wei Ling Tan (demo contact)",
    agentPhone: demoPhone(12),
    listedAt: "2026-08-16",
    demoScenario: "clean",
  },
  {
    title: "1 Bedroom Apartment, Roncesvalles",
    description:
      "One bedroom in a well-kept low-rise on Roncesvalles Avenue, Toronto. Heat and water included in the rent, coin laundry in the basement, hardwood throughout, and street permit parking available from the city.",
    location: "Roncesvalles, Toronto",
    area: "Roncesvalles",
    country: "Canada",
    propertyType: "apartment",
    bedrooms: 1,
    bathrooms: 1,
    rent: 2_250,
    currency: "CAD",
    rentPeriod: "monthly",
    amenities: ["Heating", "Laundry", "Fibre internet"],
    imageUrl: photo("flat-openplan"),
    sourceUrl: "https://example.com/listings/toronto-roncesvalles-1bed",
    agentName: "Marc Tremblay (demo contact)",
    agentPhone: demoPhone(13),
    listedAt: "2026-08-29",
    demoScenario: "clean",
  },
  {
    title: "3 Bedroom Apartment, Lekki Phase 1",
    description:
      "Three bedroom in a serviced block off Admiralty Way, Lekki Phase 1. Dedicated parking, estate security, backup generator on a shared diesel arrangement, prepaid electricity meter, and treated borehole water. Rent payable annually in advance.",
    location: "Lekki Phase 1, Lagos",
    area: "Lekki Phase 1",
    country: "Nigeria",
    propertyType: "apartment",
    bedrooms: 3,
    bathrooms: 3,
    rent: 7_500_000,
    currency: "NGN",
    rentPeriod: "yearly",
    amenities: [
      "Parking",
      "Security",
      "Backup power",
      "Air conditioning",
      "Prepaid meter",
      "Water supply",
    ],
    imageUrl: photo("flat-serviced"),
    sourceUrl: "https://example.com/listings/lagos-lekki-3bed",
    agentName: "Adaeze Okoro (demo contact)",
    agentPhone: demoPhone(14),
    listedAt: "2026-08-02",
    demoScenario: "clean",
  },
];
