"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatDuration } from "@/domain/format";
import type { ActivityEvent, VerificationStatus } from "@/domain/types";
import { Spinner } from "./SearchForm";
import { CheckIcon, PhoneIcon, WarnIcon, cn } from "./ui";

/**
 * Live verification activity panel.
 *
 * Polls the status endpoint, which advances the server-side state machine on
 * every call and returns the append-only event log. When the verification
 * reaches a terminal state the panel stops polling and refreshes the page so
 * the settled result renders.
 */

interface Snapshot {
  id: string;
  status: VerificationStatus;
  callStatus: string | null;
  provider: "call-e" | "mock" | null;
  isLive: boolean;
  score: number | null;
  failureMessage: string | null;
  durationSeconds: number | null;
  events: ActivityEvent[];
  isTerminal: boolean;
}

const POLL_INTERVAL_MS = 1_400;

export function VerificationActivity({
  verificationId,
  initialStatus,
  initialEvents,
}: {
  verificationId: string;
  initialStatus: VerificationStatus;
  initialEvents: ActivityEvent[];
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const settledRef = useRef(false);

  const status = snapshot?.status ?? initialStatus;
  const events = snapshot?.events ?? initialEvents;
  const isTerminal =
    snapshot?.isTerminal ??
    (initialStatus !== "pending" && initialStatus !== "in_progress");

  const poll = useCallback(async () => {
    try {
      const response = await fetch("/api/verifications/" + verificationId + "/status", {
        cache: "no-store",
      });
      if (!response.ok) {
        setPollError("Lost contact with the verification service.");
        return true; // stop polling
      }
      const next = (await response.json()) as Snapshot;
      setSnapshot(next);
      setPollError(null);
      return next.isTerminal;
    } catch {
      setPollError("Lost contact with the verification service.");
      return true;
    }
  }, [verificationId]);

  useEffect(() => {
    if (isTerminal && !snapshot) return;
    if (settledRef.current) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (cancelled) return;
      const done = await poll();
      if (cancelled) return;
      if (done) {
        settledRef.current = true;
        // Give the final events a beat to render before swapping in the
        // settled view.
        setTimeout(() => {
          if (!cancelled) router.refresh();
        }, 900);
        return;
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // `snapshot` deliberately excluded: including it would restart the loop on
    // every poll result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poll, router]);

  const active = status === "pending" || status === "in_progress";

  // A live CALL-E call can sit in the provider's queue for two to three minutes
  // while the voice agent is built, before the phone rings at all. Without a
  // visible clock that reads as a hung page, so the elapsed time is shown and
  // the copy says plainly what is being waited on.
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [active]);

  const queued = status === "pending" || snapshot?.callStatus === "queued";

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white">
      {/* --- Header --------------------------------------------------------- */}
      <div
        className={cn(
          "flex items-center gap-3 border-b px-5 py-4",
          active
            ? "border-signal-200 bg-signal-50/70"
            : "border-[var(--border-subtle)] bg-ink-50/60",
        )}
      >
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full text-white",
            active ? "bg-signal-600 animate-ring" : statusColor(status),
          )}
        >
          {active ? <PhoneIcon /> : status === "verified" ? <CheckIcon /> : <WarnIcon />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
            Verification activity
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-ink-900">
            {headline(status, snapshot?.callStatus ?? null)}
          </p>
        </div>

        {active ? (
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="tabular text-[13px] font-medium text-signal-700">
              {formatDuration(elapsed)}
            </span>
            <Spinner className="text-signal-600" />
          </div>
        ) : null}
      </div>

      {/* --- What we are waiting on ----------------------------------------- */}
      {active && queued && snapshot?.isLive ? (
        <p className="border-b border-[var(--border-subtle)] bg-signal-50/60 px-5 py-2.5 text-[12px] leading-relaxed text-signal-700">
          CALL-E is building the voice agent before it dials. This usually takes one to three
          minutes; the phone rings once it is ready.
        </p>
      ) : null}

      {/* --- Provider note -------------------------------------------------- */}
      {snapshot?.provider ? (
        <p
          className={cn(
            "border-b border-[var(--border-subtle)] px-5 py-2 text-[11px]",
            snapshot.isLive ? "bg-verified-50 text-verified-600" : "bg-ink-50 text-ink-500",
          )}
        >
          {snapshot.isLive
            ? "Real outbound call placed through CALL-E."
            : "Simulated call (demo mode). No number was dialled."}
        </p>
      ) : null}

      {/* --- Event log ------------------------------------------------------ */}
      <ol className="thin-scroll max-h-[420px] space-y-0 overflow-y-auto px-5 py-4">
        {events.length === 0 ? (
          <li className="py-6 text-center text-[13px] text-ink-400">
            Waiting for the first update…
          </li>
        ) : (
          events.map((event, index) => (
            <li
              key={event.id}
              className="animate-rise relative flex gap-3 pb-4 last:pb-0"
              style={{ animationDelay: Math.min(index * 30, 240) + "ms" }}
            >
              {/* Timeline rail */}
              {index < events.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute left-[7px] top-5 h-[calc(100%-12px)] w-px bg-ink-100"
                />
              ) : null}

              <span
                className={cn(
                  "mt-1 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full",
                  eventDot(event.level),
                )}
              />

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[13px] leading-snug",
                    event.level === "error"
                      ? "font-medium text-alert-600"
                      : event.level === "warning"
                        ? "font-medium text-caution-600"
                        : "text-ink-700",
                  )}
                >
                  {event.message}
                </p>
                <p className="tabular mt-0.5 text-[11px] text-ink-400">
                  {new Date(event.at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </p>
              </div>
            </li>
          ))
        )}
      </ol>

      {/* --- Footer --------------------------------------------------------- */}
      {pollError ? (
        <p
          role="alert"
          className="border-t border-[var(--border-subtle)] bg-alert-50 px-5 py-3 text-[13px] text-alert-600"
        >
          {pollError} The property has not been marked as verified.
        </p>
      ) : snapshot?.failureMessage ? (
        <p
          role="alert"
          className="border-t border-[var(--border-subtle)] bg-alert-50 px-5 py-3 text-[13px] text-alert-600"
        >
          {snapshot.failureMessage}
        </p>
      ) : snapshot?.isTerminal && snapshot.score !== null ? (
        <p className="border-t border-[var(--border-subtle)] bg-verified-50 px-5 py-3 text-[13px] font-medium text-verified-600">
          Verification complete — {snapshot.score}% verified
          {snapshot.durationSeconds
            ? " · call lasted " + formatDuration(snapshot.durationSeconds)
            : ""}
        </p>
      ) : null}
    </div>
  );
}

function headline(status: VerificationStatus, callStatus: string | null): string {
  if (status === "pending") return "Preparing the call — waiting on the provider…";
  if (status === "in_progress") {
    if (callStatus === "dialing") return "Dialing the listing contact…";
    return "On the call with the listing contact…";
  }
  if (status === "verified") return "Verification complete";
  if (status === "disputed") return "Verified, with discrepancies against the listing";
  if (status === "unavailable") return "Property is no longer available";
  if (status === "failed") return "Verification could not be completed";
  return "Not yet verified";
}

function statusColor(status: VerificationStatus): string {
  if (status === "verified") return "bg-verified-500";
  if (status === "disputed") return "bg-caution-500";
  if (status === "unavailable") return "bg-alert-500";
  return "bg-ink-400";
}

function eventDot(level: ActivityEvent["level"]): string {
  switch (level) {
    case "success":
      return "bg-verified-500";
    case "warning":
      return "bg-caution-500";
    case "error":
      return "bg-alert-500";
    default:
      return "bg-ink-300";
  }
}
