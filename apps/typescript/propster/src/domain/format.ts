/**
 * Formatting helpers shared by server and client components.
 *
 * These must live outside any `"use client"` module: a function exported from
 * a client module becomes a client reference and cannot be invoked during
 * server rendering.
 */

/** Seconds as m:ss, for call durations and transcript offsets. */
export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return minutes + ":" + String(remainder).padStart(2, "0");
}
