import { describe, expect, it } from "vitest";
import {
  extractRequirementWithRules,
  statesCurrencyExplicitly,
  statesPeriodExplicitly,
} from "@/server/requirements/ruleExtractor";

/**
 * The deterministic parser must recognise currencies and rent periods written
 * as WORDS, not only as symbols.
 *
 * Every one of these patterns was silently dead: a shell heredoc collapsed the
 * `\b` word-boundary escapes in the regex table into raw 0x08 backspace bytes,
 * so `/\beur\b/` became `/\x08eur\x08/` and could only match text containing an
 * actual backspace character. The suite stayed green because every existing
 * case used a symbol — `₦8 million`, `€1,800` — and the symbol alternatives
 * were the one part of each pattern that survived.
 *
 * These tests use words exclusively, so the same corruption cannot pass again.
 */
describe("currency words in the rule parser", () => {
  it.each([
    ["a 2 bed in Lisbon under 1800 EUR a month", "EUR"],
    ["a 2 bed in Lisbon for 1800 euros a month", "EUR"],
    ["a flat in Manchester under 1200 GBP a month", "GBP"],
    ["a flat in Manchester for 1200 pounds a month", "GBP"],
    ["a place in Austin under 2300 USD a month", "USD"],
    ["a place in Austin for 2300 dollars a month", "USD"],
    ["a 3 bed in Lekki under 8 million naira a year", "NGN"],
    ["a villa in Dubai under 90000 AED a year", "AED"],
    ["a flat in Dubai for 90000 dirhams a year", "AED"],
    ["a house in Nairobi for 120000 shillings a month", "KES"],
    ["a flat in Mumbai for 60000 rupees a month", "INR"],
    ["a place in Mexico City for 20000 pesos a month", "MXN"],
    ["a flat in Sao Paulo for 4000 reais a month", "BRL"],
    ["an apartment in Tokyo for 200000 yen a month", "JPY"],
  ])("reads the currency from %j", (text, expected) => {
    expect(statesCurrencyExplicitly(text)).toBe(true);
    expect(extractRequirementWithRules(text)?.currency).toBe(expected);
  });

  it.each([
    "1800 a month",
    "1800 per month",
    "1800 monthly",
    "1800 pcm",
    "1800 /mo",
    "20000 a year",
    "20000 per annum",
    "20000 yearly",
    "20000 annually",
  ])("reads the rent period from %j", (text) => {
    expect(statesPeriodExplicitly(text)).toBe(true);
  });

  it("does not claim a currency when none is written", () => {
    expect(statesCurrencyExplicitly("a 2 bedroom flat with parking")).toBe(false);
  });

  it("does not claim a period when none is written", () => {
    expect(statesPeriodExplicitly("a 2 bedroom flat with parking")).toBe(false);
  });

  it("does not mistake a word merely containing a currency code", () => {
    // "European" contains "eur"; a word-boundary match must not fire on it.
    expect(statesCurrencyExplicitly("a European style apartment with a balcony")).toBe(false);
  });
});
