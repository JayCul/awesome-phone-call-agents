"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "./ui";

/**
 * The requirement capture form.
 *
 * Two ways in: describe it in a sentence, or fill the fields. Both post to the
 * same endpoint, and structured fields override anything the parser inferred
 * from the prose.
 */

const DEMO_QUERY =
  "I need a 2 bedroom apartment in Lisbon under €1,800 a month. I need parking and air conditioning, and I want to move in this month.";

const AMENITY_OPTIONS = [
  "Parking",
  "Air conditioning",
  "Heating",
  "Elevator",
  "Balcony",
  "Furnished",
  "Laundry",
  "Fibre internet",
  "Security",
  "Backup power",
  "Gym",
  "Swimming pool",
];

const MOVE_IN_OPTIONS = ["immediately", "this month", "next month", "within 3 months", "flexible"];

interface ApiErrorBody {
  error?: { message?: string; hint?: string };
}

export function SearchForm({ prefillDemo = false }: { prefillDemo?: boolean }) {
  const router = useRouter();

  const [mode, setMode] = useState<"prose" | "fields">("prose");
  const [naturalLanguage, setNaturalLanguage] = useState(prefillDemo ? DEMO_QUERY : "");
  const [location, setLocation] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [minRent, setMinRent] = useState("");
  const [maxRent, setMaxRent] = useState("");
  const [rentPeriod, setRentPeriod] = useState<"yearly" | "monthly">("yearly");
  const [moveInDate, setMoveInDate] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [additional, setAdditional] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAmenity = (value: string) => {
    setAmenities((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  };

  const buildStructured = () => {
    const structured: Record<string, unknown> = {};
    if (location.trim()) structured.location = location.trim();
    if (propertyType.trim()) structured.propertyType = propertyType.trim();
    if (bedrooms) structured.bedrooms = Number(bedrooms);
    if (bathrooms) structured.bathrooms = Number(bathrooms);
    if (minRent) structured.minRent = Number(minRent);
    if (maxRent) structured.maxRent = Number(maxRent);
    structured.rentPeriod = rentPeriod;
    if (moveInDate) structured.moveInDate = moveInDate;
    if (amenities.length > 0) structured.amenities = amenities;
    const extras = additional
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (extras.length > 0) structured.additionalRequirements = extras;
    return Object.keys(structured).length > 1 ? structured : undefined;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          naturalLanguage: naturalLanguage.trim() || undefined,
          structured: buildStructured(),
        }),
      });

      const payload: unknown = await response.json();

      if (!response.ok) {
        const body = payload as ApiErrorBody;
        setError(body.error?.hint ?? body.error?.message ?? "That search could not be run.");
        return;
      }

      const result = payload as { searchId: string; found: number };
      if (result.found === 0) {
        // Still navigate: the dashboard explains an empty result better than
        // an inline message can.
        router.push("/dashboard/" + result.searchId);
        return;
      }
      router.push("/dashboard/" + result.searchId);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Mode switch */}
      <div className="inline-flex rounded-xl border border-[var(--border-subtle)] bg-ink-50 p-1">
        <ModeButton active={mode === "prose"} onClick={() => setMode("prose")}>
          Describe it
        </ModeButton>
        <ModeButton active={mode === "fields"} onClick={() => setMode("fields")}>
          Use filters
        </ModeButton>
      </div>

      {mode === "prose" ? (
        <div>
          <label htmlFor="nl" className="block text-sm font-medium text-ink-800">
            What are you looking for?
          </label>
          <textarea
            id="nl"
            value={naturalLanguage}
            onChange={(event) => setNaturalLanguage(event.target.value)}
            rows={4}
            placeholder={DEMO_QUERY}
            className="mt-2 w-full resize-none rounded-xl border border-[var(--border-strong)] bg-white px-4 py-3.5 text-[15px] leading-relaxed text-ink-900 shadow-sm outline-none transition-shadow placeholder:text-ink-400 focus:border-signal-400 focus:ring-4 focus:ring-signal-100"
          />
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-400">Try:</span>
            <button
              type="button"
              onClick={() => setNaturalLanguage(DEMO_QUERY)}
              className="rounded-lg border border-[var(--border-subtle)] bg-white px-2.5 py-1 text-xs text-ink-600 transition-colors hover:bg-ink-50"
            >
              2 bed in Lisbon under €1,800 with parking
            </button>
            <button
              type="button"
              onClick={() =>
                setNaturalLanguage(
                  "1 bed in East Austin under $2,300 a month, needs parking and in-unit laundry",
                )
              }
              className="rounded-lg border border-[var(--border-subtle)] bg-white px-2.5 py-1 text-xs text-ink-600 transition-colors hover:bg-ink-50"
            >
              1 bed in Austin under $2,300 with parking
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Location" required>
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Lisbon, Austin, Berlin…"
              className={cn(inputClass, "w-full")}
            />
          </Field>

          <Field label="Property type">
            <select
              value={propertyType}
              onChange={(event) => setPropertyType(event.target.value)}
              className={cn(inputClass, "w-full")}
            >
              <option value="">Any</option>
              <option value="apartment">Apartment / flat</option>
              <option value="terrace">Terrace</option>
              <option value="duplex">Duplex</option>
              <option value="bungalow">Bungalow</option>
              <option value="studio">Studio</option>
            </select>
          </Field>

          <Field label="Bedrooms">
            <select
              value={bedrooms}
              onChange={(event) => setBedrooms(event.target.value)}
              className={cn(inputClass, "w-full")}
            >
              <option value="">Any</option>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Bathrooms">
            <select
              value={bathrooms}
              onChange={(event) => setBathrooms(event.target.value)}
              className={cn(inputClass, "w-full")}
            >
              <option value="">Any</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Minimum rent">
            <input
              value={minRent}
              onChange={(event) => setMinRent(event.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="0"
              className={cn(inputClass, "tabular w-full")}
            />
          </Field>

          <Field label="Maximum rent">
            <div className="flex gap-2">
              <input
                value={maxRent}
                onChange={(event) => setMaxRent(event.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="1800"
                className={cn(inputClass, "tabular min-w-0 flex-1")}
              />
              <select
                value={rentPeriod}
                onChange={(event) =>
                  setRentPeriod(event.target.value === "monthly" ? "monthly" : "yearly")
                }
                className={cn(inputClass, "w-28 shrink-0")}
              >
                <option value="yearly">/ year</option>
                <option value="monthly">/ month</option>
              </select>
            </div>
          </Field>

          <Field label="Move-in timeframe">
            <select
              value={moveInDate}
              onChange={(event) => setMoveInDate(event.target.value)}
              className={cn(inputClass, "w-full")}
            >
              <option value="">No preference</option>
              {MOVE_IN_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <div className="sm:col-span-2">
            <span className="block text-sm font-medium text-ink-800">Required amenities</span>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {AMENITY_OPTIONS.map((option) => {
                const active = amenities.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleAmenity(option)}
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
              These drive the questions asked on the verification call.
            </p>
          </div>

          <div className="sm:col-span-2">
            <Field label="Anything else (one per line)">
              <textarea
                value={additional}
                onChange={(event) => setAdditional(event.target.value)}
                rows={2}
                placeholder={"Ground floor preferred\nQuiet street"}
                className={cn(inputClass, "w-full resize-none leading-relaxed")}
              />
            </Field>
          </div>
        </div>
      )}

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-alert-500/25 bg-alert-50 px-4 py-3 text-sm text-alert-600"
        >
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-ink-900 px-6 text-sm font-semibold text-white transition-all hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Spinner />
              Searching listings…
            </>
          ) : (
            "Search properties"
          )}
        </button>
        <p className="text-xs text-ink-400">
          No calls are placed yet. You choose which properties to verify.
        </p>
      </div>
    </form>
  );
}

const inputClass =
  "rounded-xl border border-[var(--border-strong)] bg-white px-3.5 py-2.5 text-[15px] text-ink-900 shadow-sm outline-none transition-shadow placeholder:text-ink-400 focus:border-signal-400 focus:ring-4 focus:ring-signal-100";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink-800">
        {label}
        {required ? <span className="ml-0.5 text-alert-500">*</span> : null}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
        active ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800",
      )}
    >
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-4 w-4 animate-spin", className)}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path
        d="M14 8a6 6 0 0 0-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
