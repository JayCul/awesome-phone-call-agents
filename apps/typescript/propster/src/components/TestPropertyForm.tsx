"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Spinner } from "./SearchForm";
import { cn } from "./ui";
import { CURRENCIES, currencySymbol, marketDefaults } from "@/domain/money";

/**
 * Lets a visitor describe a property and give their own number, so Propster
 * calls them and they can play the letting agent.
 *
 * The consent checkbox is not decoration. Submitting this form is what makes a
 * real phone ring, so the assertion that the number belongs to the submitter is
 * captured explicitly and stored against the listing.
 */

const AMENITIES = [
  "Parking",
  "Air conditioning",
  "Heating",
  "Elevator",
  "Balcony",
  "Furnished",
  "Fibre internet",
  "Security",
];

const inputClass =
  "rounded-xl border border-[var(--border-strong)] bg-white px-3.5 py-2.5 text-[15px] text-ink-900 shadow-sm outline-none transition-shadow placeholder:text-ink-400 focus:border-signal-400 focus:ring-4 focus:ring-signal-100";

export function TestPropertyForm({ live }: { live: boolean }) {
  const router = useRouter();

  const [title, setTitle] = useState("2 Bedroom Apartment, Príncipe Real");
  const [area, setArea] = useState("Lisbon");
  const [propertyType, setPropertyType] = useState("apartment");
  const [bedrooms, setBedrooms] = useState("2");
  const [bathrooms, setBathrooms] = useState("2");
  const [rent, setRent] = useState("1650");
  const [rentPeriod, setRentPeriod] = useState<"yearly" | "monthly">("monthly");
  const [currency, setCurrency] = useState("EUR");
  const [amenities, setAmenities] = useState<string[]>(["Parking", "Air conditioning"]);
  const [agentName, setAgentName] = useState("");
  const [agentPhone, setAgentPhone] = useState("+");
  const [consent, setConsent] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Follow the market when the area changes, so someone testing a London flat
   * is not quoting euros by accident. Only the untouched defaults move; once
   * the visitor picks a currency themselves it is left alone.
   */
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const onAreaChange = (value: string) => {
    setArea(value);
    if (currencyTouched) return;
    const market = marketDefaults(value);
    if (market) {
      setCurrency(market.currency);
      setRentPeriod(market.period);
    }
  };

  const toggle = (value: string) =>
    setAmenities((current) =>
      current.includes(value) ? current.filter((a) => a !== value) : [...current, value],
    );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!consent) {
      setError("Please confirm the number is yours before continuing.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/test-properties", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          area: area.trim(),
          propertyType,
          bedrooms: Number(bedrooms),
          bathrooms: bathrooms ? Number(bathrooms) : undefined,
          rent: Number(rent),
          currency,
          rentPeriod,
          amenities,
          agentName: agentName.trim() || undefined,
          agentPhone: agentPhone.trim(),
          consent,
        }),
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        const body = payload as { error?: { hint?: string; message?: string } };
        setError(body.error?.hint ?? body.error?.message ?? "That could not be submitted.");
        return;
      }

      const result = payload as { verifyUrl: string };
      router.push(result.verifyUrl);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-7">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="block text-sm font-medium text-ink-800">Listing title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className={cn(inputClass, "mt-2 w-full")}
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-ink-800">Area</span>
          <input
            value={area}
            onChange={(e) => onAreaChange(e.target.value)}
            required
            placeholder="Lisbon, Austin, Berlin…"
            className={cn(inputClass, "mt-2 w-full")}
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-ink-800">Property type</span>
          <select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            className={cn(inputClass, "mt-2 w-full")}
          >
            <option value="apartment">Apartment / flat</option>
            <option value="terrace">Terrace</option>
            <option value="duplex">Duplex</option>
            <option value="bungalow">Bungalow</option>
            <option value="studio">Studio</option>
          </select>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-ink-800">Bedrooms</span>
          <select
            value={bedrooms}
            onChange={(e) => setBedrooms(e.target.value)}
            className={cn(inputClass, "mt-2 w-full")}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-ink-800">Bathrooms</span>
          <select
            value={bathrooms}
            onChange={(e) => setBathrooms(e.target.value)}
            className={cn(inputClass, "mt-2 w-full")}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="block text-sm font-medium text-ink-800">Advertised rent</span>
          <div className="mt-2 flex gap-2">
            <select
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                setCurrencyTouched(true);
              }}
              aria-label="Currency"
              className={cn(inputClass, "w-28 shrink-0")}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {currencySymbol(code)} {code}
                </option>
              ))}
            </select>
            <input
              value={rent}
              onChange={(e) => setRent(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              required
              className={cn(inputClass, "tabular min-w-0 flex-1")}
            />
            <select
              value={rentPeriod}
              onChange={(e) => setRentPeriod(e.target.value === "monthly" ? "monthly" : "yearly")}
              className={cn(inputClass, "w-32 shrink-0")}
            >
              <option value="yearly">/ year</option>
              <option value="monthly">/ month</option>
            </select>
          </div>
          <p className="mt-2 text-xs text-ink-400">
            Quote a different figure on the call and Propster will flag the mismatch.
          </p>
        </label>

        <div className="sm:col-span-2">
          <span className="block text-sm font-medium text-ink-800">Advertised amenities</span>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {AMENITIES.map((option) => {
              const active = amenities.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggle(option)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors",
                    active
                      ? "border-signal-500 bg-signal-50 text-signal-700"
                      : "border-[var(--border-subtle)] bg-white text-ink-600 hover:bg-ink-50",
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink-400">
            These become the questions asked on the call. Deny one and watch the score drop.
          </p>
        </div>
      </div>

      {/* --- Contact ------------------------------------------------------- */}
      <div className="rounded-2xl border border-[var(--border-strong)] bg-ink-50/60 p-5">
        <h3 className="text-sm font-semibold text-ink-900">Who should Propster call?</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">
          Use your own number. You will play the letting agent, and the AI will ask you about the
          property above.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="block text-sm font-medium text-ink-800">Your name (optional)</span>
            <input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Agent name for the listing"
              className={cn(inputClass, "mt-2 w-full")}
            />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-ink-800">Your phone number</span>
            <input
              value={agentPhone}
              onChange={(e) => setAgentPhone(e.target.value.replace(/[^\d+]/g, ""))}
              placeholder="+351912345678"
              required
              inputMode="tel"
              className={cn(inputClass, "tabular mt-2 w-full")}
            />
            <span className="mt-1.5 block text-xs text-ink-400">
              International format, starting with +
            </span>
          </label>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 accent-ink-900"
          />
          <span className="text-[13px] leading-relaxed text-ink-700">
            This is my own number and I agree to receive an automated call from Propster.
            {live ? null : (
              <span className="text-ink-400">
                {" "}
                (Demo mode is on, so no call will actually be placed.)
              </span>
            )}
          </span>
        </label>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-alert-500/25 bg-alert-50 px-4 py-3 text-sm text-alert-600"
        >
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={submitting || !consent}
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-ink-900 px-6 text-sm font-semibold text-white transition-all hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? <Spinner /> : null}
          {submitting ? "Creating listing…" : "Create the listing"}
        </button>
        <p className="text-xs text-ink-400">
          This only creates the listing. Nothing is dialled until you press verify.
        </p>
      </div>
    </form>
  );
}
