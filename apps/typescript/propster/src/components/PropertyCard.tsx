"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { canonicalizeAmenities, amenityLabel } from "@/domain/amenities";
import { formatMoney } from "@/domain/money";
import { responsiveSources, srcSetFor } from "@/domain/images";
import type { PropertyDiscrepancy, PropertyListing, RequirementMatch } from "@/domain/types";
import { Spinner } from "./SearchForm";
import { BathIcon, BedIcon, Card, CheckIcon, PhoneIcon, StatusPill, WarnIcon, cn } from "./ui";

/**
 * One listing in the shortlist. Shows the advertised facts, how well they
 * match the requirement, and — once a call has happened — what the agent
 * actually said.
 */

export interface PropertyCardProps {
  rank: number;
  searchId: string;
  listing: PropertyListing;
  match: RequirementMatch;
  verificationScore?: number;
  verificationId?: string;
  isCandidate: boolean;
  discrepancies: PropertyDiscrepancy[];
  requiredAmenities: string[];
}

export function PropertyCard(props: PropertyCardProps) {
  const router = useRouter();
  const { listing, match, discrepancies } = props;

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const perPeriod = listing.rentPeriod === "monthly" ? "month" : "year";
  const art = responsiveSources(listing.imageUrl);
  const required = new Set(canonicalizeAmenities(props.requiredAmenities));
  const listedAmenities = canonicalizeAmenities(listing.amenities);
  // Show the amenities the user asked for first; they are what matters here.
  const shownAmenities = [
    ...listedAmenities.filter((key) => required.has(key)),
    ...listedAmenities.filter((key) => !required.has(key)),
  ].slice(0, 4);

  const verifying =
    listing.verificationStatus === "pending" || listing.verificationStatus === "in_progress";
  const settled =
    listing.verificationStatus === "verified" ||
    listing.verificationStatus === "disputed" ||
    listing.verificationStatus === "unavailable";

  const detailHref = "/property/" + listing.id + "?searchId=" + props.searchId;

  const startVerification = async () => {
    setError(null);
    setStarting(true);
    try {
      const response = await fetch("/api/properties/" + listing.id + "/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ searchId: props.searchId }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        const body = payload as { error?: { hint?: string; message?: string } };
        setError(body.error?.hint ?? body.error?.message ?? "Could not start verification.");
        return;
      }
      // The detail page hosts the live activity panel.
      router.push(detailHref);
    } catch {
      setError("Could not reach the server to start the call.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <Card
      className={cn(
        "group flex flex-col overflow-hidden transition-shadow hover:shadow-[0_4px_20px_rgb(0_0_0/0.07)]",
        listing.verificationStatus === "unavailable" && "opacity-70",
      )}
    >
      {/* --- Image ---------------------------------------------------------- */}
      <div className="relative aspect-[16/10] overflow-hidden bg-ink-100">
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={art.src}
            srcSet={srcSetFor(art)}
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full animate-sweep" />
        )}

        <div className="absolute left-3 top-3 flex items-center gap-2">
          <span className="tabular rounded-lg bg-ink-900/85 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            #{props.rank}
          </span>
          {props.isCandidate && !settled && !verifying ? (
            <span className="rounded-lg bg-white/90 px-2 py-1 text-[11px] font-semibold text-ink-700 backdrop-blur-sm">
              Candidate
            </span>
          ) : null}
        </div>

        <div className="absolute right-3 top-3">
          <StatusPill
            status={listing.verificationStatus}
            score={props.verificationScore}
            className="bg-white/92 backdrop-blur-sm"
          />
        </div>
      </div>

      {/* --- Body ----------------------------------------------------------- */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-semibold leading-snug tracking-[-0.01em] text-ink-900">
          {listing.title}
        </h3>
        <p className="mt-0.5 text-[13px] text-ink-500">{listing.location}</p>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="tabular text-xl font-semibold tracking-[-0.02em] text-ink-900">
            {formatMoney(listing.rent, listing.currency)}
          </span>
          <span className="text-[13px] text-ink-500">/ {perPeriod}</span>
        </div>

        <div className="mt-2.5 flex items-center gap-4 text-[13px] text-ink-600">
          <span className="inline-flex items-center gap-1.5">
            <BedIcon className="text-ink-400" />
            {listing.bedrooms} bed
          </span>
          {listing.bathrooms !== undefined ? (
            <span className="inline-flex items-center gap-1.5">
              <BathIcon className="text-ink-400" />
              {listing.bathrooms} bath
            </span>
          ) : null}
          <span className="capitalize text-ink-500">{listing.propertyType}</span>
        </div>

        <ul className="mt-3.5 space-y-1">
          {shownAmenities.map((key) => (
            <li key={key} className="flex items-center gap-2 text-[13px] text-ink-600">
              <CheckIcon
                className={required.has(key) ? "text-verified-500" : "text-ink-300"}
              />
              <span className={required.has(key) ? "font-medium text-ink-800" : undefined}>
                {amenityLabel(key)}
              </span>
            </li>
          ))}
        </ul>

        {/* Discrepancies are the point of the product: never bury them. */}
        {discrepancies.length > 0 ? (
          <div className="mt-3.5 space-y-1.5">
            {discrepancies.slice(0, 2).map((discrepancy) => (
              <div
                key={discrepancy.field}
                className={cn(
                  "flex items-start gap-2 rounded-lg px-2.5 py-2 text-[12px] leading-snug",
                  discrepancy.severity === "high"
                    ? "bg-alert-50 text-alert-600"
                    : "bg-caution-50 text-caution-600",
                )}
              >
                <WarnIcon className="mt-px shrink-0" />
                <span>
                  <strong className="font-semibold">{discrepancy.listedValue}</strong>
                  {" → "}
                  <strong className="font-semibold">{discrepancy.verifiedValue}</strong>
                </span>
              </div>
            ))}
            {discrepancies.length > 2 ? (
              <p className="pl-1 text-[12px] text-ink-500">
                +{discrepancies.length - 2} more mismatch
                {discrepancies.length - 2 > 1 ? "es" : ""}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* --- Scores ------------------------------------------------------- */}
        <div className="mt-auto pt-4">
          <div className="flex items-center gap-3 border-t border-[var(--border-subtle)] pt-3.5">
            <Metric label="Match" value={match.score + "%"} tone="neutral" />
            <span className="h-8 w-px bg-[var(--border-subtle)]" />
            <Metric
              label="Verified"
              value={props.verificationScore !== undefined ? props.verificationScore + "%" : "—"}
              tone={
                props.verificationScore === undefined
                  ? "muted"
                  : props.verificationScore >= 75
                    ? "good"
                    : props.verificationScore >= 50
                      ? "warn"
                      : "bad"
              }
            />
          </div>

          {error ? (
            <p role="alert" className="mt-3 text-[12px] leading-snug text-alert-600">
              {error}
            </p>
          ) : null}

          <div className="mt-3.5 flex gap-2">
            <Link
              href={detailHref}
              className="flex-1 rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2.5 text-center text-[13px] font-semibold text-ink-800 transition-colors hover:bg-ink-50"
            >
              View details
            </Link>

            {settled ? null : verifying ? (
              <Link
                href={detailHref}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-signal-600 px-3 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-signal-700"
              >
                <PhoneIcon />
                Watch call
              </Link>
            ) : (
              <button
                type="button"
                onClick={startVerification}
                disabled={starting || !listing.agentPhone}
                title={listing.agentPhone ? undefined : "No contact number on this listing"}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-ink-900 px-3 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {starting ? <Spinner /> : <PhoneIcon />}
                {starting ? "Calling…" : "Verify with AI"}
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "good" | "warn" | "bad" | "muted";
}) {
  const color = {
    neutral: "text-ink-900",
    good: "text-verified-600",
    warn: "text-caution-600",
    bad: "text-alert-600",
    muted: "text-ink-300",
  }[tone];

  return (
    <div className="flex-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">{label}</p>
      <p className={cn("tabular mt-0.5 text-sm font-semibold", color)}>{value}</p>
    </div>
  );
}
