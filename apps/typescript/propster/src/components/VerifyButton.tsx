"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Spinner } from "./SearchForm";
import { PhoneIcon } from "./ui";

/**
 * Starts a verification from the property detail page. On success it refreshes
 * the route so the server renders the live activity panel, which then takes
 * over the polling.
 */
export function VerifyButton({
  propertyId,
  searchId,
  label = "Verify with AI",
}: {
  propertyId: string;
  searchId: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/properties/" + propertyId + "/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ searchId }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        const body = payload as { error?: { hint?: string; message?: string } };
        setError(
          body.error?.hint ??
            body.error?.message ??
            "Unable to verify this property right now. It has not been marked as verified.",
        );
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server to start the call.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <Spinner /> : <PhoneIcon />}
        {busy ? "Starting the call…" : label}
      </button>
      {error ? (
        <p role="alert" className="mt-2.5 text-[13px] leading-snug text-alert-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
