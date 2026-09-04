"use client";

import Link from "next/link";
import { Reveal, useTimedSequence } from "./motion";

/**
 * 11 — Watch an investigation happen.
 *
 * A working readout embedded in the marketing page. It runs on a timer with no
 * interaction required, then loops, so a visitor who arrives mid-way still
 * sees the whole thing.
 *
 * The steps mirror the real pipeline the product runs — search, shortlist,
 * call, verify, discover, score — and the discovery line is amber because it
 * is the moment Propster finds something the listing never said.
 */

interface Step {
  text: string;
  detail?: string;
  tone: "info" | "done" | "active" | "found";
}

const STEPS: Step[] = [
  { text: "Searching listings", detail: "12 candidates found", tone: "done" },
  { text: "Shortlisting", detail: "6 candidates", tone: "done" },
  { text: "Investigating property #04", detail: "CALL-E connected", tone: "active" },
  { text: "Verifying availability", detail: "Confirmed", tone: "done" },
  { text: "Verifying rent", detail: "€1,650 / month", tone: "done" },
  { text: "Checking additional fees", detail: "€3,300 deposit discovered", tone: "found" },
];

export function LiveInvestigation() {
  const { ref, index } = useTimedSequence(STEPS.length, 1250, 4200);
  const complete = index >= STEPS.length;

  return (
    <section id="live" data-nav="dark" className="relative overflow-hidden bg-void-900 py-28 lg:py-40">
      <div className="relative mx-auto max-w-[1600px] px-6 lg:px-10">
        <Reveal>
          <p className="type-info text-[10px] text-white/35">Live</p>
        </Reveal>

        <h2 className="type-display size-section mt-10 max-w-[23ch] text-white">
          <Reveal variant="line">WATCH AN</Reveal>
          <Reveal variant="line" delay={90}>
            INVESTIGATION HAPPEN.
          </Reveal>
        </h2>

        <div ref={ref} className="mt-20 grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-24">
          {/* --- The readout ---------------------------------------------------- */}
          <div className="border border-white/10 bg-void-850">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <p className="type-info text-[10px] tracking-[0.3em] text-white">PROPSTER</p>
                <p className="type-info mt-1.5 text-[9px] text-white/35">Investigation #0248</p>
              </div>
              <p
                className={
                  "type-info flex items-center gap-2 text-[10px] " +
                  (complete ? "text-verified-400" : "text-signal-300")
                }
              >
                <span
                  className={
                    "inline-block h-1.5 w-1.5 rounded-full " +
                    (complete ? "bg-verified-400" : "animate-blink bg-signal-400")
                  }
                />
                {complete ? "Complete" : "Active"}
              </p>
            </div>

            {/* Steps */}
            <ol className="px-6 py-6">
              {STEPS.map((step, stepIndex) => {
                const visible = stepIndex < index;
                return (
                  <li
                    key={step.text}
                    className="flex items-start gap-4 py-3.5 transition-all duration-500"
                    style={{
                      opacity: visible ? 1 : 0.12,
                      transform: visible ? "none" : "translate3d(0,6px,0)",
                    }}
                  >
                    <Mark tone={step.tone} shown={visible} />
                    <div className="min-w-0 flex-1">
                      <p className="type-info text-[10px] text-white/75">{step.text}</p>
                      {step.detail && visible ? (
                        <p
                          className={
                            "type-data mt-1.5 text-[13px] " +
                            (step.tone === "found"
                              ? "text-caution-400"
                              : step.tone === "active"
                                ? "text-signal-300"
                                : "text-verified-400")
                          }
                        >
                          {step.detail}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>

            {/* Result */}
            <div
              className="border-t border-white/10 px-6 py-7 transition-all duration-700"
              style={{ opacity: complete ? 1 : 0.15 }}
            >
              <div className="flex items-baseline justify-between gap-6">
                <p className="type-info text-[10px] text-white/45">Result</p>
                <p className="type-data text-3xl font-medium text-white">
                  92 <span className="text-lg text-white/35">/ 100</span>
                </p>
              </div>
              <p className="type-info mt-3 text-right text-[10px] text-verified-400">Verified</p>
            </div>
          </div>

          {/* --- What just happened --------------------------------------------- */}
          <div className="lg:pt-6">
            <Reveal>
              <p className="text-[19px] leading-relaxed text-white/60 lg:text-[22px]">
                No dashboard to learn. You describe what you want, and Propster does the searching,
                the calling and the checking.
              </p>
            </Reveal>

            <Reveal delay={140}>
              <p className="type-info mt-10 text-[9px] leading-loose text-white/45">
                This readout mirrors the pipeline the product actually runs. In the application it
                is driven by live provider events from the call in progress.
              </p>
            </Reveal>

            <Reveal delay={200}>
              <Link
                href="/search"
                className="type-info group mt-12 inline-flex items-center gap-3 rounded-full bg-white px-7 py-4 text-[10px] text-void-900 transition-transform duration-300 hover:scale-[1.02]"
              >
                Run one yourself
                <span
                  aria-hidden="true"
                  className="transition-transform duration-300 group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function Mark({ tone, shown }: { tone: Step["tone"]; shown: boolean }) {
  if (!shown) {
    return (
      <span
        aria-hidden="true"
        className="mt-1 block h-3.5 w-3.5 shrink-0 rounded-full border border-white/20"
      />
    );
  }

  if (tone === "active") {
    return (
      <span
        aria-hidden="true"
        className="animate-blink mt-1 block h-3.5 w-3.5 shrink-0 rounded-full bg-signal-400"
      />
    );
  }

  if (tone === "found") {
    return (
      <svg
        viewBox="0 0 16 16"
        className="mt-0.5 h-4 w-4 shrink-0 text-caution-400"
        fill="none"
        aria-hidden="true"
      >
        <path d="M8 2.8 14.2 13.4H1.8L8 2.8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 6.6v3.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11.5" r="0.8" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 16 16"
      className="mt-0.5 h-4 w-4 shrink-0 text-verified-400"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m3.5 8.5 3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
