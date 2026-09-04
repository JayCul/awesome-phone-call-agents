/**
 * Phone numbers, and which of them are safe to put in demo data.
 *
 * Every seeded listing must carry a number that CANNOT reach a human being.
 * An earlier version of this project invented a block (+234 700 0000 0xx) that
 * merely looked fake: +234 700 is a live Nigerian prefix, so a bug that dialled
 * one could have rung an actual subscriber who has no idea why an AI is asking
 * them about a property.
 *
 * The ranges below are different in kind. Each is set aside by its national
 * regulator specifically so that films, television and documentation can quote
 * a number without it belonging to anyone. They are never allocated.
 */

interface ReservedRange {
  pattern: RegExp;
  /** Where the reservation comes from, so it can be checked. */
  authority: string;
}

const RESERVED_RANGES: ReservedRange[] = [
  {
    // Ofcom reserves 07700 900000–900999 for drama and documentation.
    pattern: /^\+447700900\d{3}$/,
    authority: "Ofcom drama range (United Kingdom)",
  },
  {
    // NANP reserves 555-0100 to 555-0199 across every area code for fiction.
    pattern: /^\+1\d{3}55501\d{2}$/,
    authority: "NANP 555-01xx fictional range (US and Canada)",
  },
  {
    // ACMA reserves 0491 570 006–015 for use in advertising and drama.
    pattern: /^\+61491570\d{3}$/,
    authority: "ACMA drama range (Australia)",
  },
  {
    // Retained so that a number from the project's earlier, invented block is
    // still refused by the submission guard rather than silently accepted.
    pattern: /^\+23470000000\d{2}$/,
    authority: "legacy Propster demo block (deprecated, never dial)",
  },
];

/**
 * True when a number belongs to a range reserved for fiction.
 *
 * Two places depend on this and both are safety-critical: `/try` refuses to
 * accept such a number so a fabricated listing cannot be used to reach whoever
 * might own it, and the verification service routes it to the simulated
 * provider rather than to a real telephone network.
 */
export function isReservedDemoPhone(phone: string): boolean {
  const trimmed = phone.trim();
  return RESERVED_RANGES.some((range) => range.pattern.test(trimmed));
}

/** Which reservation a number falls under, for diagnostics. Null if none. */
export function reservedRangeAuthority(phone: string): string | null {
  const trimmed = phone.trim();
  return RESERVED_RANGES.find((range) => range.pattern.test(trimmed))?.authority ?? null;
}

/** E.164: a leading +, a non-zero country code, then 7 to 14 more digits. */
export const E164 = /^\+[1-9]\d{7,14}$/;

export function isE164(phone: string): boolean {
  return E164.test(phone.trim());
}

/**
 * A stable fictional number for seeded listing number `n`.
 *
 * Drawn from the Ofcom drama range regardless of where the property is, because
 * a number that cannot ring anyone matters more than a number that looks local.
 * The README says so, and the listings are labelled as demo contacts.
 */
export function demoPhone(n: number): string {
  return "+447700900" + String(n % 1000).padStart(3, "0");
}

/** Mask for display. Never render a full contact number in the UI. */
export function maskPhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.length <= 5) return "•••••";
  return trimmed.slice(0, 4) + " ••• " + trimmed.slice(-3);
}
