"use client";

import { Reveal, useTimedSequence } from "./motion";

/**
 * 05 — The call.
 *
 * The photography stops here. This is the first fully near-black section, and
 * the visual language switches from architectural to instrumental: a call
 * header, a checklist resolving in real time, a waveform, and a transcript.
 *
 * It is restrained on purpose. A voice assistant with a glowing orb would read
 * as a toy; this should read as a line being recorded.
 */

const CHECKS = [
  { label: "Availability", state: "done" },
  { label: "Annual rent", state: "done" },
  { label: "Parking", state: "active" },
  { label: "Air conditioning", state: "pending" },
  { label: "Additional fees", state: "pending" },
] as const;

const TRANSCRIPT = [
  { speaker: "PROPSTER", line: "Is the property still available?" },
  { speaker: "CONTACT", line: "Yes, it is." },
  { speaker: "PROPSTER", line: "And what is the current annual rent?" },
] as const;

export function CallExperience() {
  // Reveals the transcript one turn at a time, then holds.
  const { ref, index } = useTimedSequence(TRANSCRIPT.length, 1900, 5200);

  return (
    <section data-nav="dark" className="relative overflow-hidden bg-void-900 py-28 lg:py-40">
      {/* A single cool wash so the black is not flat. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 70% at 50% 0%, rgb(52 98 246 / 0.10), transparent 62%)",
        }}
      />

      <div ref={ref} className="relative mx-auto max-w-[1100px] px-6 lg:px-10">
        {/* --- Call header --------------------------------------------------- */}
        <Reveal>
          <div className="flex flex-wrap items-center justify-between gap-6 border-b border-white/10 pb-8">
            <div className="flex items-center gap-4">
              <span className="type-info text-[13px] tracking-[0.3em] text-white">CALL-E</span>
              <span className="type-info flex items-center gap-2 text-[10px] text-verified-400">
                <span className="animate-blink inline-block h-1.5 w-1.5 rounded-full bg-verified-400" />
                Connected
              </span>
            </div>

            <div className="flex items-center gap-8">
              <div>
                <p className="type-info text-[9px] text-white/35">Property #04</p>
                <p className="type-data mt-1 text-sm text-white">Príncipe Real, Lisbon</p>
              </div>
              <p className="type-data text-2xl text-white">00:42</p>
            </div>
          </div>
        </Reveal>

        <div className="grid gap-14 pt-12 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
          {/* --- Verification checklist -------------------------------------- */}
          <Reveal delay={120}>
            <p className="type-info text-[10px] text-white/35">Verifying</p>

            <ul className="mt-7 space-y-0">
              {CHECKS.map((check) => (
                <li
                  key={check.label}
                  className="flex items-center justify-between border-b border-white/[0.07] py-4"
                >
                  <span
                    className={
                      "type-info text-[10px] " +
                      (check.state === "pending" ? "text-white/30" : "text-white/80")
                    }
                  >
                    {check.label}
                  </span>
                  <StateMark state={check.state} />
                </li>
              ))}
            </ul>

            {/* --- Waveform ---------------------------------------------------- */}
            <div
              aria-hidden="true"
              className="mt-10 flex h-12 items-center gap-[3px]"
            >
              {WAVE.map((height, index) => (
                <span
                  key={index}
                  className="animate-wave block w-[3px] rounded-full bg-signal-400/70"
                  style={{
                    height: height + "%",
                    ["--wave-delay" as string]: (index * 47) % 900 + "ms",
                  }}
                />
              ))}
            </div>
          </Reveal>

          {/* --- Transcript ---------------------------------------------------- */}
          <Reveal delay={200}>
            <p className="type-info text-[10px] text-white/35">Live transcript</p>

            <div className="mt-7 space-y-8">
              {TRANSCRIPT.map((turn, turnIndex) => {
                const visible = turnIndex < index;
                const isAgent = turn.speaker === "PROPSTER";
                return (
                  <div
                    key={turn.line}
                    className="transition-all duration-700"
                    style={{
                      opacity: visible ? 1 : 0,
                      transform: visible ? "none" : "translate3d(0,14px,0)",
                    }}
                  >
                    <p
                      className={
                        "type-info text-[9px] " +
                        (isAgent ? "text-signal-300" : "text-white/35")
                      }
                    >
                      {turn.speaker}
                    </p>
                    <p
                      className={
                        "mt-2.5 text-[19px] leading-snug lg:text-[22px] " +
                        (isAgent ? "text-white" : "text-white/55")
                      }
                    >
                      &ldquo;{turn.line}&rdquo;
                    </p>
                  </div>
                );
              })}

              {/* The cursor that says the call has not finished. */}
              <span
                aria-hidden="true"
                className="animate-blink inline-block h-5 w-[2px] bg-signal-400"
                style={{ opacity: index >= TRANSCRIPT.length ? 1 : 0 }}
              />
            </div>
          </Reveal>
        </div>

        {/* --- The disclosure, stated plainly ---------------------------------- */}
        <Reveal delay={260}>
          <p className="type-info mt-20 max-w-xl text-[10px] leading-loose text-white/45">
            Every call opens by identifying itself as an AI assistant. It never negotiates, never
            commits, and never claims to be human.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function StateMark({ state }: { state: "done" | "active" | "pending" }) {
  if (state === "done") {
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4 text-verified-400" fill="none" aria-hidden="true">
        <path
          d="m3.5 8.5 3 3 6-7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (state === "active") {
    return (
      <span className="animate-blink block h-2 w-2 rounded-full bg-signal-400" aria-hidden="true" />
    );
  }
  return <span className="block h-2 w-2 rounded-full border border-white/25" aria-hidden="true" />;
}

/** Fixed heights so the waveform is deterministic between renders. */
const WAVE = [
  28, 46, 72, 38, 90, 55, 30, 68, 84, 42, 26, 60, 96, 48, 34, 74, 52, 88, 36, 62, 44, 78, 30, 56,
  92, 40, 66, 32, 80, 50, 70, 38, 58, 86, 44, 28, 64, 48, 76, 34,
] as const;
