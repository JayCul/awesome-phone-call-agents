/**
 * Money, in any market Propster operates in.
 *
 * Rent is not comparable across currencies, and Propster never tries: a
 * listing, its verification and the user's budget all carry the same currency,
 * and a discrepancy is only ever computed between two figures in that one
 * currency. There is no exchange-rate conversion anywhere in the product,
 * deliberately — a rate that moves would make yesterday's verification wrong.
 *
 * Magnitudes differ enormously between markets: a monthly rent is ~1,400 in
 * euros and ~7,500,000 in naira per year. Formatting therefore compacts only
 * where compaction actually helps.
 */

export const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "NGN",
  "AED",
  "ZAR",
  "KES",
  "SGD",
  "CAD",
  "AUD",
  "INR",
  "MXN",
  "BRL",
  "JPY",
] as const;

export type Currency = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = "USD";

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

/** Coerce a stored or submitted value, falling back rather than throwing. */
export function asCurrency(value: unknown, fallback: Currency = DEFAULT_CURRENCY): Currency {
  return isCurrency(value) ? value : fallback;
}

/**
 * Currencies whose symbol Intl does not produce in an English locale: it
 * returns the ISO code instead, so a card would read "NGN7.5M". These are the
 * forms people in those markets actually write.
 *
 * AED is deliberately absent: "AED 145,000" is how it is normally written, and
 * Intl already spaces it correctly.
 */
const SYMBOL_OVERRIDES: Partial<Record<Currency, string>> = {
  NGN: "₦",
  ZAR: "R",
  KES: "KSh",
  SGD: "S$",
};

const symbolCache = new Map<Currency, string>();

/** The currency's symbol on its own, e.g. "€", "₦", "$". */
export function currencySymbol(currency: Currency): string {
  const cached = symbolCache.get(currency);
  if (cached) return cached;

  const override = SYMBOL_OVERRIDES[currency];
  if (override) {
    symbolCache.set(currency, override);
    return override;
  }

  let symbol: string = currency;
  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).formatToParts(1);
    symbol = parts.find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    // An unknown currency code should degrade to the code itself, not crash a
    // property card.
  }
  symbolCache.set(currency, symbol);
  return symbol;
}

/**
 * Format an amount for display.
 *
 * Figures of a million or more are compacted ("₦7.5M"), because a naira or
 * rupee rent written in full is unreadable in a table. Everything below is
 * written out in full ("€1,400"), because compacting a European monthly rent
 * to "€1.4k" loses precision people care about.
 */
export function formatMoney(amount: number, currency: Currency): string {
  const magnitude = Math.abs(amount);

  if (magnitude >= 1_000_000) {
    const millions = amount / 1_000_000;
    const rendered = Number.isInteger(millions) ? millions.toFixed(0) : millions.toFixed(1);
    const symbol = currencySymbol(currency);
    // A symbol abuts its number; a bare code needs a space ("AED 1.2M").
    return symbol === currency ? symbol + " " + rendered + "M" : symbol + rendered + "M";
  }

  return withSymbol(amount, currency);
}

/**
 * Format a figure with its symbol.
 *
 * Where a symbol override exists, Intl's currency style is bypassed entirely:
 * it would emit the ISO code ("SGD 5,400") where the market writes a symbol
 * ("S$5,400"). Everything else goes through Intl, which places and spaces its
 * own symbols correctly.
 */
function withSymbol(amount: number, currency: Currency): string {
  const override = SYMBOL_OVERRIDES[currency];
  if (override) {
    return override + Math.round(amount).toLocaleString("en");
  }
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return currency + " " + Math.round(amount).toLocaleString("en");
  }
}

/** Full precision, for fee tables where the exact figure matters. */
export function formatMoneyExact(amount: number, currency: Currency): string {
  return withSymbol(amount, currency);
}

/**
 * Which currency a market quotes rent in, and whether it does so per month or
 * per year. Used to give the search form and the demo sensible defaults; a
 * listing always carries its own values and never infers them from here.
 */
const MARKET_DEFAULTS: Record<string, { currency: Currency; period: "monthly" | "yearly" }> = {
  lisbon: { currency: "EUR", period: "monthly" },
  porto: { currency: "EUR", period: "monthly" },
  barcelona: { currency: "EUR", period: "monthly" },
  madrid: { currency: "EUR", period: "monthly" },
  berlin: { currency: "EUR", period: "monthly" },
  amsterdam: { currency: "EUR", period: "monthly" },
  paris: { currency: "EUR", period: "monthly" },
  london: { currency: "GBP", period: "monthly" },
  manchester: { currency: "GBP", period: "monthly" },
  austin: { currency: "USD", period: "monthly" },
  "new york": { currency: "USD", period: "monthly" },
  chicago: { currency: "USD", period: "monthly" },
  toronto: { currency: "CAD", period: "monthly" },
  vancouver: { currency: "CAD", period: "monthly" },
  dubai: { currency: "AED", period: "yearly" },
  "abu dhabi": { currency: "AED", period: "yearly" },
  singapore: { currency: "SGD", period: "monthly" },
  melbourne: { currency: "AUD", period: "monthly" },
  sydney: { currency: "AUD", period: "monthly" },
  "cape town": { currency: "ZAR", period: "monthly" },
  johannesburg: { currency: "ZAR", period: "monthly" },
  nairobi: { currency: "KES", period: "monthly" },
  bengaluru: { currency: "INR", period: "monthly" },
  mumbai: { currency: "INR", period: "monthly" },
  "mexico city": { currency: "MXN", period: "monthly" },
  "sao paulo": { currency: "BRL", period: "monthly" },
  tokyo: { currency: "JPY", period: "monthly" },
  lagos: { currency: "NGN", period: "yearly" },
  lekki: { currency: "NGN", period: "yearly" },
  ikoyi: { currency: "NGN", period: "yearly" },
  yaba: { currency: "NGN", period: "yearly" },
  ikeja: { currency: "NGN", period: "yearly" },
  ajah: { currency: "NGN", period: "yearly" },
  "victoria island": { currency: "NGN", period: "yearly" },
  abuja: { currency: "NGN", period: "yearly" },
};

/** Best guess at how a named market quotes rent. Undefined when unknown. */
export function marketDefaults(
  location: string,
): { currency: Currency; period: "monthly" | "yearly" } | undefined {
  const needle = location.trim().toLowerCase();
  if (!needle) return undefined;
  for (const [city, defaults] of Object.entries(MARKET_DEFAULTS)) {
    if (needle.includes(city)) return defaults;
  }
  return undefined;
}
