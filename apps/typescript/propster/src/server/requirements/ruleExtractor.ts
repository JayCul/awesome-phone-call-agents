import {
  propertySearchRequirementSchema,
  type ParsedRequirement,
} from "@/domain/schemas";
import { marketDefaults, type Currency } from "@/domain/money";

/**
 * Deterministic natural-language requirement parser.
 *
 * This is the fallback when no model key is configured, and the safety net when
 * the model returns something that fails validation. It handles the notation
 * renters actually use across markets: "€1,450", "$2,300 a month", "8m",
 * "₦8 million", "800k pcm".
 *
 * It is intentionally conservative. A field it cannot read confidently is left
 * undefined rather than guessed, because a wrong budget silently filters out
 * the property the user wanted.
 */

/**
 * Cities and districts the deterministic parser can recognise.
 *
 * This list exists only so the fallback works without a language model; it is
 * not a limit on where Propster operates. The model path handles any place
 * name, and a listing carries whatever location it was created with. More
 * specific entries come first so "Lisbon" does not win over "Campo de Ourique".
 */
const KNOWN_AREAS = [
  // Portugal
  "Campo de Ourique", "Principe Real", "Príncipe Real", "Alcantara", "Alcântara",
  "Arroios", "Graca", "Graça", "Belem", "Belém", "Lisbon", "Lisboa", "Porto",
  // Spain
  "Eixample", "Gracia", "Gràcia", "Barcelona", "Madrid",
  // Germany
  "Prenzlauer Berg", "Kreuzberg", "Neukolln", "Neukölln", "Mitte", "Berlin", "Munich",
  // United Kingdom
  "London Fields", "Hackney", "Shoreditch", "Islington", "Camden", "Peckham",
  "London", "Manchester", "Edinburgh", "Bristol",
  // Ireland, Netherlands, France
  "Dublin", "Amsterdam", "Rotterdam", "Paris", "Lyon",
  // United States and Canada
  "East Austin", "Austin", "Brooklyn", "Queens", "Manhattan", "New York",
  "Chicago", "Seattle", "Denver", "Roncesvalles", "Toronto", "Vancouver", "Montreal",
  // Middle East
  "Jumeirah Lake Towers", "Jumeirah", "Dubai Marina", "Downtown Dubai", "Dubai",
  "Abu Dhabi", "Doha",
  // Africa
  "Sea Point", "Green Point", "Woodstock", "Cape Town", "Johannesburg", "Sandton",
  "Westlands", "Kilimani", "Nairobi", "Accra", "Lekki Phase 1", "Lekki", "Ikoyi",
  "Victoria Island", "Yaba", "Ikeja", "Ajah", "Lagos", "Abuja",
  // Asia and Oceania
  "Tiong Bahru", "Orchard", "Singapore", "Bengaluru", "Bangalore", "Mumbai",
  "Delhi", "Tokyo", "Osaka", "Hong Kong", "Melbourne", "Sydney", "Brisbane", "Auckland",
  // Latin America
  "Condesa", "Roma Norte", "Mexico City", "Sao Paulo", "São Paulo", "Bogota", "Bogotá",
];

const PROPERTY_TYPES: Array<[RegExp, string]> = [
  [/\bself[\s-]?contain(ed)?\b/i, "self contain"],
  [/\bmini[\s-]?flat\b/i, "mini flat"],
  [/\bstudio\b/i, "studio"],
  [/\b(apartment|flat)\b/i, "apartment"],
  [/\bduplex\b/i, "duplex"],
  [/\bterrace[d]?\b/i, "terrace"],
  [/\bbungalow\b/i, "bungalow"],
  [/\bdetached\b/i, "detached"],
  [/\bpenthouse\b/i, "penthouse"],
  [/\bhouse\b/i, "house"],
];

const AMENITY_PATTERNS: Array<[RegExp, string]> = [
  [/\b(parking|car\s?park|garage|carport)\b/i, "parking"],
  [/\bpre[\s-]?paid(\s+(meter|electricity))?\b/i, "prepaid meter"],
  [/\b(security|gated|guard|cctv)\b/i, "security"],
  [/\b(generator|gen\b|backup power|inverter)\b/i, "generator"],
  [/\b(borehole|water supply|treated water)\b/i, "borehole"],
  [/\b(internet|fibre|fiber|broadband|wi[\s-]?fi)\b/i, "internet"],
  [/\b(air[\s-]?condition(ing|ed)?|\bac\b|a\/c)\b/i, "air conditioning"],
  [/\b(furnished)\b/i, "furnished"],
  [/\bgym\b/i, "gym"],
  [/\b(swimming\s?)?pool\b/i, "swimming pool"],
  [/\b(lift|elevator)\b/i, "elevator"],
  [/\bserviced\b/i, "serviced"],
  [/\bpets?\b/i, "pets"],
];

/**
 * Which currency the text is quoted in, from a symbol or an ISO code.
 * Undefined when nothing indicates one; the caller then falls back to whatever
 * the named market usually quotes.
 */
const CURRENCY_HINTS: Array<[RegExp, Currency]> = [
  [/(\beur\b|€|\beuros?\b)/i, "EUR"],
  [/(\bgbp\b|£|\bpounds?\b|\bquid\b)/i, "GBP"],
  [/(\busd\b|\bdollars?\b|\$)/i, "USD"],
  [/(\bngn\b|₦|\bnaira\b)/i, "NGN"],
  [/(\baed\b|\bdirhams?\b|\bdhs?\b)/i, "AED"],
  [/(\bzar\b|\brands?\b|\br\d)/i, "ZAR"],
  [/(\bkes\b|\bshillings?\b|\bksh\b)/i, "KES"],
  [/(\bsgd\b|\bs\$)/i, "SGD"],
  [/(\bcad\b|\bc\$)/i, "CAD"],
  [/(\baud\b|\ba\$)/i, "AUD"],
  [/(\binr\b|₹|\brupees?\b)/i, "INR"],
  [/(\bmxn\b|\bpesos?\b)/i, "MXN"],
  [/(\bbrl\b|\breais?\b)/i, "BRL"],
  [/(\bjpy\b|¥|\byen\b)/i, "JPY"],
];

function detectCurrency(text: string): Currency | undefined {
  for (const [pattern, currency] of CURRENCY_HINTS) {
    if (pattern.test(text)) return currency;
  }
  return undefined;
}

/** Parse a money phrase into a plain number, in whatever currency was meant. */
export function parseMoney(text: string): number | undefined {
  // Matches: 8m, 8 million, ₦8.5m, N8,000,000, 800k, 750,000
  const pattern =
    /(?:₦|ngn|naira|n(?=\s*[\d]))?\s*([\d][\d,]*(?:\.\d+)?)\s*(million|mill|m\b|k\b|thousand)?/i;
  const match = pattern.exec(text);
  if (!match) return undefined;

  const digits = match[1];
  if (!digits) return undefined;
  const base = Number(digits.replace(/,/g, ""));
  if (!Number.isFinite(base) || base <= 0) return undefined;

  const unit = match[2]?.toLowerCase();
  if (unit === "k" || unit === "thousand") return base * 1_000;
  if (unit && unit.startsWith("m")) return base * 1_000_000;

  // No magnitude word. A bare number is taken at face value: "under 1500" in
  // Lisbon means 1500 euros, not 1.5 billion. Markets that quote in millions
  // say so ("8 million"), and the caller can still supply an explicit figure.
  return base;
}

/**
 * Whether the rent is quoted per month or per year.
 *
 * Markets disagree: most of Europe and North America quote a month, Dubai and
 * Lagos quote a year. When the renter has not said, the market they named is a
 * better guess than a global default, so the caller supplies one.
 */
function detectRentPeriod(
  text: string,
  fallback: "monthly" | "yearly" = "monthly",
): "monthly" | "yearly" {
  if (/\b(per|a|\/)\s*month\b|\bmonthly\b|\bpm\b|\/mo\b|\bpcm\b/i.test(text)) return "monthly";
  if (/\b(per|a|\/)\s*(year|annum)\b|\byearly\b|\bannually\b|\bp\.?a\.?\b/i.test(text)) {
    return "yearly";
  }
  return fallback;
}

function detectLocation(text: string): string | undefined {
  for (const area of KNOWN_AREAS) {
    const pattern = new RegExp("\\b" + area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
    if (pattern.test(text)) return area;
  }
  // "in Somewhere" / "at Somewhere" as a last resort.
  const fallback = /\b(?:in|at|around|near)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})/.exec(text);
  return fallback?.[1];
}

function detectBedrooms(text: string): number | undefined {
  const numeric = /(\d+)\s*(?:-|\s)?\s*bed(?:room)?s?\b/i.exec(text);
  if (numeric?.[1]) {
    const value = Number(numeric[1]);
    if (Number.isFinite(value) && value >= 0 && value <= 20) return value;
  }
  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  };
  const worded = /\b(one|two|three|four|five|six|seven|eight)\s*(?:-|\s)?\s*bed(?:room)?s?\b/i.exec(text);
  const key = worded?.[1]?.toLowerCase();
  if (key && key in words) return words[key];
  if (/\bstudio\b|\bself[\s-]?contain/i.test(text)) return 1;
  return undefined;
}

function detectBathrooms(text: string): number | undefined {
  const match = /(\d+)\s*(?:-|\s)?\s*bath(?:room)?s?\b/i.exec(text);
  if (!match?.[1]) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 0 && value <= 20 ? value : undefined;
}

function detectBudget(text: string): { minRent?: number; maxRent?: number } {
  const result: { minRent?: number; maxRent?: number } = {};

  const between = /\bbetween\s+(.+?)\s+and\s+([^,.;]+)/i.exec(text);
  if (between?.[1] && between[2]) {
    const low = parseMoney(between[1]);
    const high = parseMoney(between[2]);
    if (low !== undefined) result.minRent = low;
    if (high !== undefined) result.maxRent = high;
    if (result.minRent !== undefined || result.maxRent !== undefined) return result;
  }

  const max = /\b(?:under|below|less than|max(?:imum)?|up to|not more than|within|budget of)\s+([^,.;]+)/i.exec(text);
  if (max?.[1]) {
    const value = parseMoney(max[1]);
    if (value !== undefined) result.maxRent = value;
  }

  const min = /\b(?:over|above|at least|min(?:imum)?|from)\s+([^,.;]+)/i.exec(text);
  if (min?.[1]) {
    const value = parseMoney(min[1]);
    if (value !== undefined) result.minRent = value;
  }

  return result;
}

function detectMoveIn(text: string): string | undefined {
  const patterns: Array<[RegExp, string]> = [
    [/\b(immediately|right away|asap|as soon as possible)\b/i, "immediately"],
    [/\b(this month|within the month)\b/i, "this month"],
    [/\bnext month\b/i, "next month"],
    [/\bwithin (?:the )?next (\d+) (week|month)s?\b/i, ""],
    [/\bwithin (\d+) (week|month)s?\b/i, ""],
    [/\bin (\d+) (week|month)s?\b/i, ""],
    [
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
      "",
    ],
  ];

  for (const [pattern, label] of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    if (label) return label;
    if (match[2]) return "within " + match[1] + " " + match[2] + (Number(match[1]) > 1 ? "s" : "");
    return match[1]?.toLowerCase();
  }
  return undefined;
}

function detectAmenities(text: string): string[] {
  const found = new Set<string>();
  for (const [pattern, label] of AMENITY_PATTERNS) {
    if (pattern.test(text)) found.add(label);
  }
  return [...found];
}

function detectPropertyType(text: string): string | undefined {
  for (const [pattern, label] of PROPERTY_TYPES) {
    if (pattern.test(text)) return label;
  }
  return undefined;
}

/**
 * Extra constraints worth telling the phone agent about, even though they are
 * not structured fields — "ground floor only", "close to the expressway".
 */
function detectAdditional(text: string): string[] {
  const notes: string[] = [];
  if (/\bground floor\b/i.test(text)) notes.push("Ground floor preferred");
  if (/\bnewly (built|renovated)\b/i.test(text)) notes.push("Newly built or renovated");
  if (/\bbq\b|\bboys?\s?quarters?\b/i.test(text)) notes.push("Boys quarters required");
  if (/\bno agent fee|without agency fee\b/i.test(text)) notes.push("Wants to avoid agency fees");
  if (/\bpay(ment)? plan|instal?ment\b/i.test(text)) notes.push("Asking about a payment plan");
  if (/\bfamily\b/i.test(text)) notes.push("Family occupancy");
  return notes;
}

/**
 * Parse free text into a requirement. Returns null when there is not even a
 * location to work with, so the caller can ask the user for more.
 */
export function extractRequirementWithRules(text: string): ParsedRequirement | null {
  const trimmed = text.trim();
  if (trimmed.length < 3) return null;

  const location = detectLocation(trimmed);
  if (!location) return null;

  const budget = detectBudget(trimmed);
  const market = marketDefaults(location);
  const currency = detectCurrency(trimmed) ?? market?.currency;
  const period = detectRentPeriod(trimmed, market?.period);

  const candidate = {
    location,
    propertyType: detectPropertyType(trimmed),
    bedrooms: detectBedrooms(trimmed),
    bathrooms: detectBathrooms(trimmed),
    minRent: budget.minRent,
    maxRent: budget.maxRent,
    currency,
    rentPeriod: period,
    moveInDate: detectMoveIn(trimmed),
    amenities: detectAmenities(trimmed),
    additionalRequirements: detectAdditional(trimmed),
  };

  const result = propertySearchRequirementSchema.safeParse(candidate);
  return result.success ? result.data : null;
}

/**
 * Did the text state a rent period explicitly ("a month", "per annum")?
 *
 * Used to tell a renter's statement apart from a model's guess: when neither
 * the renter nor the market is ambiguous, the market is better evidence.
 */
export function statesPeriodExplicitly(text: string): boolean {
  return /\b(per|a|\/)\s*(month|year|annum)\b|\bmonthly\b|\byearly\b|\bannually\b|\bpcm\b|\bp\.?a\.?\b|\/mo\b/i.test(
    text,
  );
}

/** Did the text name a currency, by symbol, code or word? */
export function statesCurrencyExplicitly(text: string): boolean {
  return CURRENCY_HINTS.some(([pattern]) => pattern.test(text));
}
