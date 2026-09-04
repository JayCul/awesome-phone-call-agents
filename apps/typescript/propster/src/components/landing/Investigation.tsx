"use client";

import { ART } from "./art";
import { useScrollSteps } from "./motion";

/**
 * 06 — The investigation, told by scrolling.
 *
 * One property is pinned on the left while the right column moves through six
 * states: the claim, the call, the verification, the evidence, the discovery,
 * and the score. Scroll position *is* the timeline, so the visitor drives the
 * investigation at their own pace.
 *
 * The image is graded from warm to analytical as the states advance, which
 * repeats the page's central move at a smaller scale.
 */

interface Row {
  label: string;
  value: string;
  state?: "confirmed" | "pending" | "active" | "found";
}

interface State {
  index: string;
  title: string;
  caption?: string;
  rows: Row[];
}

const STATES: State[] = [
  {
    index: "01",
    title: "Listing",
    caption: "What the advert claims.",
    rows: [
      { label: "Monthly rent", value: "€1,650" },
      { label: "Availability", value: "Available" },
      { label: "Parking", value: "Included" },
      { label: "Air conditioning", value: "Included" },
    ],
  },
  {
    index: "02",
    title: "Calling",
    caption: "CALL-E contacts the listing agent.",
    rows: [
      { label: "Recipient", value: "Listing agent" },
      { label: "Status", value: "Dialing", state: "active" },
      { label: "Objective", value: "9 questions" },
      { label: "Identified as", value: "AI assistant" },
    ],
  },
  {
    index: "03",
    title: "Verifying",
    caption: "Answers arrive one at a time.",
    rows: [
      { label: "Availability", value: "Confirmed", state: "confirmed" },
      { label: "Annual rent", value: "Confirmed", state: "confirmed" },
      { label: "Parking", value: "Asking", state: "active" },
      { label: "Fees", value: "Not yet", state: "pending" },
    ],
  },
  {
    index: "04",
    title: "Evidence",
    caption: "Each fact is recorded with its source.",
    rows: [
      { label: "€1,650 / month", value: "Confirmed", state: "confirmed" },
      { label: "2 bedrooms", value: "Confirmed", state: "confirmed" },
      { label: "Parking", value: "Confirmed", state: "confirmed" },
      { label: "Air conditioning", value: "Confirmed", state: "confirmed" },
    ],
  },
  {
    index: "05",
    title: "Discovery",
    caption: "Something the listing never mentioned.",
    rows: [
      { label: "Deposit", value: "€3,300", state: "found" },
      { label: "Agency fee", value: "€1,650", state: "found" },
      { label: "Contract fee", value: "€250", state: "found" },
      { label: "In the listing", value: "None of it", state: "pending" },
    ],
  },
  {
    index: "06",
    title: "Verified",
    caption: "Scored on evidence, not on claims.",
    rows: [
      { label: "Verification score", value: "92 / 100", state: "confirmed" },
      { label: "Facts confirmed", value: "8", state: "confirmed" },
      { label: "Discrepancies", value: "1", state: "found" },
      { label: "Real first-year cost", value: "€25,000", state: "found" },
    ],
  },
];

export function Investigation() {
  const { ref, step } = useScrollSteps<HTMLDivElement>(STATES.length);
  const active = STATES[step] ?? STATES[0];
  if (!active) return null;

  // Warm at the start, analytical by the end.
  const t = step / (STATES.length - 1);

  return (
    <section
      id="verification"
      data-nav="dark"
      ref={ref}
      className="relative bg-void-900"
    >
      <div className="relative h-[560svh]">
        <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
          <div className="mx-auto grid w-full max-w-[1600px] items-center gap-10 px-6 lg:grid-cols-[0.85fr_1fr] lg:gap-20 lg:px-10">
            {/* --- Pinned subject -------------------------------------------- */}
            <div className="relative hidden h-[74svh] overflow-hidden lg:block">
              <img
                src={ART.subject.src}
                srcSet={ART.subject.srcSmall + " 900w, " + ART.subject.src + " 2000w"}
                sizes="(max-width: 1024px) 100vw, 50vw"
                alt={ART.subject.alt}
                className="h-full w-full object-cover transition-[filter] duration-700"
                style={{
                  filter:
                    "saturate(" + (0.9 - t * 0.62) + ") brightness(" + (0.94 - t * 0.24) + ")",
                }}
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-signal-900 mix-blend-multiply transition-opacity duration-700"
                style={{ opacity: t * 0.32 }}
              />

              {/* Corner registration marks: the frame reads as an exhibit. */}
              <Corners />

              <div className="absolute bottom-5 left-5">
                <p className="type-info text-[9px] text-white/45">Under investigation</p>
                <p className="type-data mt-1 text-sm text-white">Property #04 · Príncipe Real, Lisbon</p>
              </div>

              {step >= 1 && step <= 2 ? (
                <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
                  <div
                    className="animate-scan absolute inset-x-0 h-28"
                    style={{
                      background:
                        "linear-gradient(180deg, transparent, rgb(52 98 246 / 0.28), transparent)",
                    }}
                  />
                </div>
              ) : null}
            </div>

            {/* --- The changing readout --------------------------------------- */}
            <div className="flex flex-col justify-center">
              {/* Step rail */}
              <div className="mb-10 flex items-center gap-2" aria-hidden="true">
                {STATES.map((state, index) => (
                  <span
                    key={state.index}
                    className="h-[2px] flex-1 origin-left bg-white/12 transition-transform duration-500"
                    style={{
                      transform: "scaleY(" + (index === step ? 2 : 1) + ")",
                      background:
                        index <= step ? "var(--color-signal-400)" : "rgb(255 255 255 / 0.12)",
                    }}
                  />
                ))}
              </div>

              <p className="type-info text-[10px] text-signal-300">
                State {active.index} — {active.title}
              </p>

              {/* The rows are keyed by step so React swaps them and the CSS
                  transition replays on every state change. */}
              <div key={active.index} className="mt-8">
                <p className="text-[19px] leading-snug text-white/60 lg:text-[22px]">
                  {active.caption}
                </p>

                <ul className="mt-10">
                  {active.rows.map((row, index) => (
                    <li
                      key={row.label}
                      className="flex items-baseline justify-between gap-6 border-b border-white/[0.07] py-4"
                      style={{
                        animation: "propster-row-in 0.6s cubic-bezier(0.22,1,0.36,1) both",
                        animationDelay: index * 70 + "ms",
                      }}
                    >
                      <span className="type-info text-[10px] text-white/45">{row.label}</span>
                      <span className={"type-data text-base " + valueTone(row.state)}>
                        {row.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="type-info mt-10 text-[9px] text-white/25 lg:hidden">
                Keep scrolling
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Local keyframe: rows enter as the state changes. Declared here so it
          travels with the component that depends on it. */}
      <style>{`
        @keyframes propster-row-in {
          from { opacity: 0; transform: translate3d(0, 10px, 0); }
          to { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes propster-row-in {
            from { opacity: 1; transform: none; }
            to { opacity: 1; transform: none; }
          }
        }
      `}</style>
    </section>
  );
}

function valueTone(state: Row["state"]): string {
  switch (state) {
    case "confirmed":
      return "text-verified-400";
    case "found":
      return "text-caution-400";
    case "active":
      return "text-signal-300";
    case "pending":
      return "text-white/30";
    default:
      return "text-white";
  }
}

function Corners() {
  const base = "absolute h-5 w-5 border-white/40";
  return (
    <span aria-hidden="true">
      <span className={base + " left-4 top-4 border-l border-t"} />
      <span className={base + " right-4 top-4 border-r border-t"} />
      <span className={base + " bottom-4 left-4 border-b border-l"} />
      <span className={base + " bottom-4 right-4 border-b border-r"} />
    </span>
  );
}
