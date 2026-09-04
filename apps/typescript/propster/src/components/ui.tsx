import type { VerificationStatus } from "@/domain/types";

/**
 * Presentation primitives shared across the dashboard and detail pages.
 * These render state; they never compute it.
 */

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

// --- Verification status ----------------------------------------------------

const STATUS_STYLES: Record<
  VerificationStatus,
  { label: string; dot: string; chip: string }
> = {
  unverified: {
    label: "Unverified",
    dot: "bg-ink-300",
    chip: "bg-ink-100 text-ink-600",
  },
  pending: {
    label: "Queued",
    dot: "bg-signal-400",
    chip: "bg-signal-50 text-signal-700",
  },
  in_progress: {
    label: "Calling",
    dot: "bg-signal-500",
    chip: "bg-signal-50 text-signal-700",
  },
  verified: {
    label: "Verified",
    dot: "bg-verified-500",
    chip: "bg-verified-50 text-verified-600",
  },
  disputed: {
    label: "Disputed",
    dot: "bg-caution-500",
    chip: "bg-caution-50 text-caution-600",
  },
  unavailable: {
    label: "Not available",
    dot: "bg-alert-500",
    chip: "bg-alert-50 text-alert-600",
  },
  failed: {
    label: "Could not verify",
    dot: "bg-ink-400",
    chip: "bg-ink-100 text-ink-600",
  },
};

export function StatusPill({
  status,
  score,
  className,
}: {
  status: VerificationStatus;
  score?: number;
  className?: string;
}) {
  const style = STATUS_STYLES[status];
  const live = status === "in_progress" || status === "pending";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        style.chip,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot, live && "animate-ring")} />
      {score !== undefined && status === "verified" ? (
        <span className="tabular">{score}% verified</span>
      ) : score !== undefined && status === "disputed" ? (
        <span className="tabular">{score}% · disputed</span>
      ) : (
        style.label
      )}
    </span>
  );
}

// --- Score dial -------------------------------------------------------------

export function ScoreDial({
  score,
  size = 76,
  label,
  tone,
}: {
  score: number;
  size?: number;
  label?: string;
  tone?: "verified" | "caution" | "alert" | "neutral";
}) {
  const resolved =
    tone ?? (score >= 75 ? "verified" : score >= 50 ? "caution" : "alert");
  const stroke = {
    verified: "var(--color-verified-500)",
    caution: "var(--color-caution-500)",
    alert: "var(--color-alert-500)",
    neutral: "var(--color-ink-400)",
  }[resolved];

  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circumference;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={(label ?? "Score") + ": " + score + " out of 100"}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-ink-100)"
          strokeWidth="6"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={dash + " " + circumference}
          style={{ transition: "stroke-dasharray 700ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span
          className="tabular font-semibold tracking-tight text-ink-900"
          style={{ fontSize: size * 0.28 }}
        >
          {score}
        </span>
      </div>
    </div>
  );
}

// --- Layout helpers ---------------------------------------------------------

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border-subtle)] bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
        {children}
      </h2>
      {hint ? <span className="text-xs text-ink-400">{hint}</span> : null}
    </div>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("h-4 w-4", className)} fill="none" aria-hidden="true">
      <path
        d="m3.5 8.5 3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WarnIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("h-4 w-4", className)} fill="none" aria-hidden="true">
      <path
        d="M8 2.8 14.2 13.4H1.8L8 2.8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8 6.6v3.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="0.85" fill="currentColor" />
    </svg>
  );
}

export function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("h-4 w-4", className)} fill="none" aria-hidden="true">
      <path
        d="M5.2 2.6 6.6 5.4 5.3 6.9c.6 1.3 1.8 2.5 3.1 3.1l1.5-1.3 2.8 1.4v2.2c0 .6-.5 1-1.1 1C6.9 13 3 9.1 2.6 4.1c0-.6.4-1.1 1-1.1h1.6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BedIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("h-4 w-4", className)} fill="none" aria-hidden="true">
      <path
        d="M2 12V5m0 4h12V9a2 2 0 0 0-2-2H7v2M14 12v-1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BathIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("h-4 w-4", className)} fill="none" aria-hidden="true">
      <path
        d="M2.5 8h11v1.8A3.2 3.2 0 0 1 10.3 13H5.7a3.2 3.2 0 0 1-3.2-3.2V8Zm2-1.2V4.3a1.3 1.3 0 0 1 2.6 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
