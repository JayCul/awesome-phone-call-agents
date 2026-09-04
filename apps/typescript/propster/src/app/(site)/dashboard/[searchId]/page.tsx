import Link from "next/link";
import { notFound } from "next/navigation";
import { PropertyCard } from "@/components/PropertyCard";
import { Card, SectionTitle, cn } from "@/components/ui";
import { toAnnual } from "@/domain/discrepancy";
import { formatMoney } from "@/domain/money";
import { ApiError } from "@/server/http";
import { getDashboard, type DashboardView } from "@/server/readModel";
import { usingRealCalle } from "@/server/env";
import { activeModel } from "@/server/llm";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ searchId: string }>;
}) {
  const { searchId } = await params;

  let view: DashboardView;
  try {
    view = await getDashboard(searchId);
  } catch (error) {
    if (error instanceof ApiError && error.code === "not_found") notFound();
    throw error;
  }

  const { requirement, counts, cards } = view;
  const live = usingRealCalle();
  // Name the model that actually did the work, rather than assuming a vendor.
  const modelLabel = activeModel() ?? "a language model";

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      {/* --- Header --------------------------------------------------------- */}
      <header className="animate-rise">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
              Your search
            </p>
            <h1 className="mt-1.5 text-3xl font-semibold tracking-[-0.025em] text-ink-900">
              {summarise(requirement)}
            </h1>
            {view.rawQuery ? (
              <p className="mt-2 max-w-3xl text-sm italic leading-relaxed text-ink-500">
                &ldquo;{view.rawQuery}&rdquo;
              </p>
            ) : null}
            <p className="mt-2 text-xs text-ink-400">
              Requirement extracted by{" "}
              {view.extractionSource === "model" ? modelLabel : "the built-in parser"} and validated
              against a strict schema.
            </p>
          </div>

          <Link
            href="/search"
            className="rounded-xl border border-[var(--border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-ink-800 transition-colors hover:bg-ink-50"
          >
            New search
          </Link>
        </div>

        {/* --- Requirement chips ------------------------------------------- */}
        <div className="mt-5 flex flex-wrap gap-2">
          <Chip label="Location" value={requirement.location} />
          {requirement.bedrooms !== undefined ? (
            <Chip label="Bedrooms" value={String(requirement.bedrooms)} />
          ) : null}
          {requirement.maxRent !== undefined ? (
            <Chip
              label="Max rent"
              value={
                formatMoney(requirement.maxRent, requirement.currency) +
                " / " +
                (requirement.rentPeriod === "monthly" ? "month" : "year")
              }
            />
          ) : null}
          {requirement.moveInDate ? <Chip label="Move in" value={requirement.moveInDate} /> : null}
          {requirement.amenities.map((amenity) => (
            <Chip key={amenity} label="Must have" value={amenity} accent />
          ))}
        </div>
      </header>

      {/* --- Counters ------------------------------------------------------- */}
      <section className="mt-8 animate-rise">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Counter value={counts.found} label="properties found" />
          <Counter value={counts.candidates} label="candidates selected" />
          <Counter value={counts.verified} label="verified" tone="good" />
          <Counter value={counts.inProgress} label="verification in progress" tone="active" />
          <Counter
            value={counts.unavailable + counts.disputed}
            label="unavailable or disputed"
            tone={counts.unavailable + counts.disputed > 0 ? "bad" : "muted"}
          />
        </div>
      </section>

      {/* --- Provider banner ------------------------------------------------ */}
      <div
        className={cn(
          "mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-3 text-[13px]",
          live
            ? "border-verified-500/20 bg-verified-50 text-verified-600"
            : "border-[var(--border-subtle)] bg-ink-50 text-ink-600",
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", live ? "bg-verified-500" : "bg-ink-400")} />
        <span className="font-semibold">
          {live ? "Live verification enabled" : "Demo mode: simulated calls"}
        </span>
        <span className={live ? "text-verified-600/80" : "text-ink-500"}>
          {live
            ? "Verifying a property places a real outbound call through CALL-E. The agent identifies itself as an AI at the start of every call."
            : "No CALL-E key is configured, so verification replays a deterministic conversation. Nothing is dialled."}
        </span>
      </div>

      {/* --- Results -------------------------------------------------------- */}
      <section className="mt-10">
        {cards.length === 0 ? (
          <EmptyState location={requirement.location} />
        ) : (
          <>
            <SectionTitle hint="Verified properties rank above unverified ones">
              Ranked shortlist
            </SectionTitle>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map((card, index) => (
                <div
                  key={card.listing.id}
                  className="animate-rise"
                  style={{ animationDelay: Math.min(index * 45, 300) + "ms" }}
                >
                  <PropertyCard
                    rank={index + 1}
                    searchId={view.searchId}
                    listing={card.listing}
                    match={card.match}
                    verificationScore={card.listing.verificationScore}
                    verificationId={card.verificationId}
                    isCandidate={card.isCandidate}
                    discrepancies={card.discrepancies}
                    requiredAmenities={requirement.amenities}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function summarise(requirement: DashboardView["requirement"]): string {
  const parts: string[] = [];
  if (requirement.bedrooms !== undefined) parts.push(requirement.bedrooms + " bedroom");
  if (requirement.propertyType) parts.push(requirement.propertyType);
  else if (requirement.bedrooms !== undefined) parts.push("property");
  parts.push("in " + requirement.location);
  return parts.join(" ");
}

function Chip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px]",
        accent
          ? "border-signal-200 bg-signal-50 text-signal-700"
          : "border-[var(--border-subtle)] bg-white text-ink-700",
      )}
    >
      <span className={accent ? "text-signal-500" : "text-ink-400"}>{label}</span>
      <span className="font-semibold capitalize">{value}</span>
    </span>
  );
}

function Counter({
  value,
  label,
  tone = "neutral",
}: {
  value: number;
  label: string;
  tone?: "neutral" | "good" | "active" | "bad" | "muted";
}) {
  const color = {
    neutral: "text-ink-900",
    good: "text-verified-600",
    active: "text-signal-600",
    bad: "text-alert-600",
    muted: "text-ink-300",
  }[tone];

  return (
    <Card className="px-4 py-3.5">
      <p className={cn("tabular text-2xl font-semibold tracking-[-0.02em]", color)}>{value}</p>
      <p className="mt-0.5 text-[12px] leading-snug text-ink-500">{label}</p>
    </Card>
  );
}

function EmptyState({ location }: { location: string }) {
  return (
    <Card className="p-12 text-center">
      <h2 className="text-xl font-semibold text-ink-900">
        No listings matched that search
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-600">
        Nothing in the corpus is close enough to a property in {location} to be worth calling
        about. Try widening the budget, relaxing the bedroom count, or searching a nearby area.
      </p>
      <Link
        href="/search"
        className="mt-6 inline-flex h-11 items-center rounded-xl bg-ink-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-ink-800"
      >
        Adjust the search
      </Link>
    </Card>
  );
}
