import Link from "next/link";
import { notFound } from "next/navigation";
import { VerificationActivity } from "@/components/VerificationActivity";
import { VerifyButton } from "@/components/VerifyButton";
import {
  BathIcon,
  BedIcon,
  Card,
  CheckIcon,
  ScoreDial,
  SectionTitle,
  StatusPill,
  WarnIcon,
  cn,
} from "@/components/ui";
import { amenityLabel, canonicalizeAmenities } from "@/domain/amenities";
import { formatDuration } from "@/domain/format";
import { summariseDiscrepancy, toAnnual } from "@/domain/discrepancy";
import { formatMoney, formatMoneyExact } from "@/domain/money";
import { isReservedDemoPhone, maskPhone } from "@/domain/phone";
import type { PropertyDiscrepancy, TranscriptTurn } from "@/domain/types";
import { usingRealCalle } from "@/server/env";
import { ApiError } from "@/server/http";
import { getPropertyDetail, type PropertyDetailView } from "@/server/readModel";

export const dynamic = "force-dynamic";

export default async function PropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ searchId?: string }>;
}) {
  const { id } = await params;
  const { searchId } = await searchParams;

  let view: PropertyDetailView;
  try {
    view = await getPropertyDetail(id, searchId);
  } catch (error) {
    if (error instanceof ApiError && error.code === "not_found") notFound();
    throw error;
  }

  const { listing, verification, breakdown, call, status } = view;

  // A simulated call has two quite different causes, and saying the wrong one
  // sends a judge off to check a key that is already set. Seed listings carry
  // numbers from ranges reserved for fiction, which are never dialled even when
  // CALL-E is fully configured.
  const simulatedBecauseDemoNumber =
    usingRealCalle() &&
    listing.agentPhone !== undefined &&
    listing.agentPhone !== null &&
    isReservedDemoPhone(listing.agentPhone);
  const isRunning = status === "pending" || status === "in_progress";

  const fees = verification
    ? ([
        ["Service charge", verification.serviceCharge],
        ["Agency fee", verification.agencyFee],
        ["Legal fee", verification.legalFee],
        ["Caution fee", verification.cautionFee],
        ["Inspection fee", verification.viewingFee],
      ] as const)
    : [];
  const disclosedFees = fees.filter(([, value]) => value !== undefined);
  const feeTotal = disclosedFees.reduce((total, [, value]) => total + (value ?? 0), 0);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      {/* --- Breadcrumb ----------------------------------------------------- */}
      <nav className="mb-6 flex items-center gap-2 text-[13px] text-ink-500">
        {searchId ? (
          <Link href={"/dashboard/" + searchId} className="hover:text-ink-900">
            ← Back to shortlist
          </Link>
        ) : (
          <Link href="/search" className="hover:text-ink-900">
            ← New search
          </Link>
        )}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr]">
        {/* ================= LEFT: the property ============================ */}
        <div className="space-y-8">
          <header className="animate-rise">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold tracking-[-0.025em] text-ink-900">
                  {listing.title}
                </h1>
                <p className="mt-1 text-sm text-ink-500">{listing.location}</p>
              </div>
              <StatusPill status={status} score={listing.verificationScore} />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="tabular text-2xl font-semibold tracking-[-0.02em] text-ink-900">
                {formatMoney(listing.rent, listing.currency)}
                <span className="ml-1.5 text-sm font-normal text-ink-500">
                  / {listing.rentPeriod === "monthly" ? "month" : "year"}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm text-ink-600">
                <BedIcon className="text-ink-400" />
                {listing.bedrooms} bedrooms
              </span>
              {listing.bathrooms !== undefined ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-ink-600">
                  <BathIcon className="text-ink-400" />
                  {listing.bathrooms} bathrooms
                </span>
              ) : null}
              <span className="text-sm capitalize text-ink-600">{listing.propertyType}</span>
            </div>
          </header>

          {listing.imageUrl ? (
            <div className="animate-rise overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={listing.imageUrl}
                alt=""
                sizes="(max-width: 1024px) 100vw, 58vw"
                className="aspect-[16/9] w-full object-cover"
              />
            </div>
          ) : null}

          {/* --- Discrepancies: top billing when they exist ---------------- */}
          {verification && verification.discrepancies.length > 0 ? (
            <section className="animate-rise">
              <SectionTitle hint="Listing versus what the agent said">
                Discrepancies found
              </SectionTitle>
              <div className="space-y-3">
                {verification.discrepancies.map((discrepancy) => (
                  <DiscrepancyCallout key={discrepancy.field} discrepancy={discrepancy} />
                ))}
              </div>
            </section>
          ) : null}

          {/* --- Listing detail -------------------------------------------- */}
          <section className="animate-rise">
            <SectionTitle hint={listing.listedAt ? "Advertised " + listing.listedAt : undefined}>
              The listing
            </SectionTitle>
            <Card className="p-6">
              <p className="text-[15px] leading-relaxed text-ink-700">{listing.description}</p>

              <div className="mt-5 flex flex-wrap gap-2">
                {canonicalizeAmenities(listing.amenities).map((key) => (
                  <span
                    key={key}
                    className="rounded-lg border border-[var(--border-subtle)] bg-ink-50 px-2.5 py-1 text-[12px] text-ink-700"
                  >
                    {amenityLabel(key)}
                  </span>
                ))}
              </div>

              <dl className="mt-6 grid gap-x-8 gap-y-3 border-t border-[var(--border-subtle)] pt-5 sm:grid-cols-2">
                <Row label="Listing contact" value={listing.agentName ?? "Not stated"} />
                <Row
                  label="Contact number"
                  value={listing.agentPhone ? maskPhone(listing.agentPhone) : "Not stated"}
                />
                <Row label="Area" value={listing.area} />
                <Row label="Source" value={listing.sourceUrl ? "Partner listing feed" : "Direct"} />
              </dl>
            </Card>
          </section>

          {/* --- What was confirmed ---------------------------------------- */}
          {verification ? (
            <section className="animate-rise">
              <SectionTitle
                hint={"Verified " + relativeTime(verification.verifiedAt)}
              >
                What the call confirmed
              </SectionTitle>
              <Card className="p-6">
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  <Confirmation
                    ok={verification.available}
                    text={
                      verification.available
                        ? "Currently available"
                        : "No longer available"
                    }
                  />
                  {verification.currentRent !== undefined ? (
                    <Confirmation
                      ok
                      text={
                        formatMoney(
                          toAnnual(
                            verification.currentRent,
                            verification.rentPeriod ?? listing.rentPeriod,
                          ),
                          verification.currency ?? listing.currency,
                        ) + " annual rent"
                      }
                    />
                  ) : (
                    <Confirmation ok={undefined} text="Rent not confirmed" />
                  )}
                  {verification.bedrooms !== undefined ? (
                    <Confirmation ok text={verification.bedrooms + " bedrooms"} />
                  ) : null}
                  {verification.bathrooms !== undefined ? (
                    <Confirmation ok text={verification.bathrooms + " bathrooms"} />
                  ) : null}
                  {verification.parkingAvailable !== undefined ? (
                    <Confirmation
                      ok={verification.parkingAvailable}
                      text={verification.parkingAvailable ? "Parking" : "No dedicated parking"}
                    />
                  ) : null}
                  {verification.electricityType ? (
                    <Confirmation ok text={capitalise(verification.electricityType)} />
                  ) : null}
                  {verification.waterSupply ? (
                    <Confirmation ok text={"Water: " + verification.waterSupply} />
                  ) : null}
                  {verification.securityAvailable !== undefined ? (
                    <Confirmation
                      ok={verification.securityAvailable}
                      text={verification.securityAvailable ? "Security on site" : "No security"}
                    />
                  ) : null}
                  {verification.generatorAvailable !== undefined ? (
                    <Confirmation
                      ok={verification.generatorAvailable}
                      text={verification.generatorAvailable ? "Backup generator" : "No generator"}
                    />
                  ) : null}
                  {verification.earliestMoveIn ? (
                    <Confirmation ok text={"Move in " + verification.earliestMoveIn} />
                  ) : null}
                  {verification.viewingAvailable !== undefined ? (
                    <Confirmation
                      ok={verification.viewingAvailable}
                      text={
                        verification.viewingAvailable
                          ? "Inspection can be arranged"
                          : "No inspection offered"
                      }
                    />
                  ) : null}
                </ul>

                {verification.agentNotes ? (
                  <div className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-ink-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                      Also mentioned on the call
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-700">
                      {verification.agentNotes}
                    </p>
                  </div>
                ) : null}
              </Card>
            </section>
          ) : null}

          {/* --- Fees ------------------------------------------------------- */}
          {disclosedFees.length > 0 ? (
            <section className="animate-rise">
              <SectionTitle hint="Collected on the verification call">
                Additional costs
              </SectionTitle>
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {fees.map(([label, value]) => (
                      <tr
                        key={label}
                        className="border-b border-[var(--border-subtle)] last:border-0"
                      >
                        <td className="px-6 py-3 text-ink-600">{label}</td>
                        <td className="tabular px-6 py-3 text-right font-medium text-ink-900">
                          {value === undefined ? (
                            <span className="text-ink-300">Not confirmed</span>
                          ) : value === 0 ? (
                            "Free"
                          ) : (
                            formatMoneyExact(value, listing.currency)
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-ink-50">
                      <td className="px-6 py-3 font-semibold text-ink-900">
                        Confirmed upfront total
                      </td>
                      <td className="tabular px-6 py-3 text-right font-semibold text-ink-900">
                        {formatMoneyExact(feeTotal, listing.currency)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {disclosedFees.length < fees.length ? (
                  <p className="border-t border-[var(--border-subtle)] bg-caution-50 px-6 py-2.5 text-[12px] text-caution-600">
                    Some fees were not confirmed on the call. The real upfront total may be higher.
                  </p>
                ) : null}
              </Card>
            </section>
          ) : null}

          {/* --- Transcript -------------------------------------------------- */}
          {call && call.transcript.length > 0 ? (
            <section className="animate-rise">
              <SectionTitle
                hint={
                  "Duration " +
                  (call.durationSeconds ? formatDuration(call.durationSeconds) : "—") +
                  " · " +
                  (call.isLive ? "CALL-E" : "simulated")
                }
              >
                Verification call transcript
              </SectionTitle>
              <Card className="p-6">
                {call.summary ? (
                  <p className="mb-5 border-l-2 border-signal-300 pl-4 text-[14px] leading-relaxed text-ink-700">
                    {call.summary}
                  </p>
                ) : null}
                <div className="thin-scroll max-h-[440px] space-y-3 overflow-y-auto pr-2">
                  {call.transcript.map((turn, index) => (
                    <TranscriptLine key={index} turn={turn} />
                  ))}
                </div>
              </Card>
            </section>
          ) : null}
        </div>

        {/* ================= RIGHT: verification =========================== */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          {/* Live panel while a call is running, or after one has finished */}
          {view.verificationId ? (
            <div className="animate-rise">
              <VerificationActivity
                verificationId={view.verificationId}
                initialStatus={status}
                initialEvents={view.events}
              />
            </div>
          ) : null}

          {/* Score breakdown */}
          {breakdown ? (
            <Card className="animate-rise p-6">
              <div className="flex items-center gap-5">
                <ScoreDial
                  score={breakdown.score}
                  size={88}
                  label="Verification score"
                  tone={
                    status === "unavailable"
                      ? "alert"
                      : status === "disputed"
                        ? "caution"
                        : undefined
                  }
                />
                <div>
                  <p className="text-lg font-semibold tracking-[-0.02em] text-ink-900">
                    {/* The band describes the score; the status describes the
                        outcome. A disputed result must not read as a clean one. */}
                    {status === "disputed"
                      ? breakdown.band + ", with discrepancies"
                      : status === "unavailable"
                        ? "Property unavailable"
                        : breakdown.band}
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink-500">
                    {verification ? "Verified " + relativeTime(verification.verifiedAt) : ""}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3 border-t border-[var(--border-subtle)] pt-5">
                {breakdown.components.map((component) => (
                  <div key={component.key}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-medium text-ink-800">
                        {component.label}
                      </span>
                      <span className="tabular text-[12px] text-ink-500">
                        {Math.round(component.earned)} / {component.weight}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width] duration-700",
                          component.status === "pass"
                            ? "bg-verified-500"
                            : component.status === "warn"
                              ? "bg-caution-500"
                              : component.status === "fail"
                                ? "bg-alert-500"
                                : "bg-ink-300",
                        )}
                        style={{ width: Math.round(component.ratio * 100) + "%" }}
                      />
                    </div>
                    <p className="mt-1 text-[12px] leading-snug text-ink-500">
                      {component.detail}
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-5 border-t border-[var(--border-subtle)] pt-4 text-[11px] leading-relaxed text-ink-400">
                Weighting: availability 30, price accuracy 20, required amenities 20, property
                details 15, additional fees 10, contact confidence 5. Contradictions between the
                listing and the call are deducted on top.
              </p>
            </Card>
          ) : null}

          {/* Requirement match */}
          {view.match ? (
            <Card className="animate-rise p-6">
              <SectionTitle>Match to your requirements</SectionTitle>
              <div className="flex items-center gap-4">
                <ScoreDial score={view.match.score} size={64} tone="neutral" label="Match" />
                <p className="text-[13px] leading-relaxed text-ink-600">
                  How closely the advert matches what you asked for, before any verification.
                </p>
              </div>
              <ul className="mt-5 space-y-1.5">
                {view.match.reasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-2 text-[13px] text-ink-700">
                    <CheckIcon className="mt-px shrink-0 text-verified-500" />
                    {reason}
                  </li>
                ))}
                {view.match.misses.map((miss) => (
                  <li key={miss} className="flex items-start gap-2 text-[13px] text-ink-500">
                    <WarnIcon className="mt-px shrink-0 text-caution-500" />
                    {miss}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* Call metadata */}
          {call ? (
            <Card className="animate-rise p-6">
              <SectionTitle>Verification call</SectionTitle>
              <dl className="space-y-2.5">
                <Row label="Provider" value={call.isLive ? "CALL-E" : "Simulated (demo mode)"} />
                <Row label="Status" value={capitalise(call.status.replace(/_/g, " "))} />
                <Row
                  label="Duration"
                  value={call.durationSeconds ? formatDuration(call.durationSeconds) : "—"}
                />
                <Row label="Started" value={new Date(call.startedAt).toLocaleString()} />
                {call.completionConfidence !== null ? (
                  <Row
                    label="Answer confidence"
                    value={Math.round(call.completionConfidence * 100) + "%"}
                  />
                ) : null}
              </dl>

              {call.evidence.length > 0 ? (
                <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                    Evidence
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {call.evidence.map((item) => (
                      <li key={item} className="text-[13px] leading-snug text-ink-600">
                        · {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {!call.isLive ? (
                <p className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-[11px] leading-relaxed text-ink-500">
                  This was a simulated call. No telephone number was dialled.{" "}
                  {simulatedBecauseDemoNumber
                    ? "This listing's contact number is in a range reserved for fiction, so it is never dialled. Enter your own number on the Call my phone page to hear a real CALL-E call."
                    : "Configure CALLE_API_KEY to place real verification calls."}
                </p>
              ) : null}
            </Card>
          ) : null}

          {/* Call to action */}
          {!view.verificationId && searchId ? (
            <Card className="animate-rise p-6">
              <h2 className="text-base font-semibold text-ink-900">Not verified yet</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-600">
                Propster will call {listing.agentName ?? "the listing contact"} and ask about
                availability, the current rent, the amenities you named, and every upfront fee.
              </p>
              <div className="mt-4">
                <VerifyButton propertyId={listing.id} searchId={searchId} />
              </div>
            </Card>
          ) : null}

          {status === "failed" && view.failureMessage ? (
            <Card className="animate-rise border-alert-500/25 bg-alert-50 p-6">
              <h2 className="text-base font-semibold text-alert-600">Unable to verify</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-alert-600">
                {view.failureMessage}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-600">
                This property has <strong>not</strong> been marked as verified.
              </p>
              {searchId ? (
                <div className="mt-4">
                  <VerifyButton propertyId={listing.id} searchId={searchId} label="Try again" />
                </div>
              ) : null}
            </Card>
          ) : null}

          {isRunning ? null : null}
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function DiscrepancyCallout({ discrepancy }: { discrepancy: PropertyDiscrepancy }) {
  const high = discrepancy.severity === "high";
  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        high ? "border-alert-500/25 bg-alert-50" : "border-caution-500/25 bg-caution-50",
      )}
    >
      <div className="flex items-center gap-2">
        <WarnIcon className={high ? "text-alert-500" : "text-caution-500"} />
        <p
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.14em]",
            high ? "text-alert-600" : "text-caution-600",
          )}
        >
          {summariseDiscrepancy(discrepancy)}
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-400">Listed</p>
          <p className="mt-1 text-lg font-semibold tracking-[-0.01em] text-ink-500 line-through decoration-ink-300">
            {discrepancy.listedValue ?? "—"}
          </p>
        </div>
        <span className="hidden text-ink-300 sm:block" aria-hidden="true">
          →
        </span>
        <div>
          <p
            className={cn(
              "text-[11px] font-medium uppercase tracking-[0.1em]",
              high ? "text-alert-600" : "text-caution-600",
            )}
          >
            Confirmed on the call
          </p>
          <p
            className={cn(
              "mt-1 text-lg font-semibold tracking-[-0.01em]",
              high ? "text-alert-600" : "text-caution-600",
            )}
          >
            {discrepancy.verifiedValue ?? "—"}
          </p>
        </div>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-ink-700">{discrepancy.explanation}</p>
    </div>
  );
}

function TranscriptLine({ turn }: { turn: TranscriptTurn }) {
  const isAgent = turn.speaker === "agent";
  return (
    <div className={cn("flex gap-3", isAgent ? "" : "flex-row-reverse")}>
      <span
        className={cn(
          "mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold",
          isAgent ? "bg-signal-100 text-signal-700" : "bg-ink-100 text-ink-600",
        )}
        title={isAgent ? "Propster AI agent" : "Listing contact"}
      >
        {isAgent ? "AI" : "PA"}
      </span>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5",
          isAgent ? "bg-signal-50 text-ink-800" : "bg-ink-50 text-ink-800",
        )}
      >
        <p className="text-[13px] leading-relaxed">{turn.text}</p>
        {turn.offsetSeconds !== null ? (
          <p className="tabular mt-1 text-[10px] text-ink-400">
            {formatDuration(turn.offsetSeconds)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Confirmation({ ok, text }: { ok: boolean | undefined; text: string }) {
  return (
    <li className="flex items-start gap-2 text-[14px]">
      {ok === true ? (
        <CheckIcon className="mt-0.5 shrink-0 text-verified-500" />
      ) : ok === false ? (
        <WarnIcon className="mt-0.5 shrink-0 text-alert-500" />
      ) : (
        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-300" />
      )}
      <span
        className={
          ok === false ? "text-alert-600" : ok === undefined ? "text-ink-400" : "text-ink-800"
        }
      >
        {text}
      </span>
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[13px] text-ink-500">{label}</dt>
      <dd className="text-[13px] font-medium text-ink-900">{value}</dd>
    </div>
  );
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes + " minute" + (minutes === 1 ? "" : "s") + " ago";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours + " hour" + (hours === 1 ? "" : "s") + " ago";
  return new Date(iso).toLocaleDateString();
}
