"use client";

import { HoverLabel, Reveal, useCountUp, useInView } from "./motion";

/**
 * Verification score.
 *
 * Deliberately not a circular progress chart. The number is set enormous and
 * typographic, and the components below it draw as horizontal rules — the
 * score is constructed in front of the visitor from named parts, which is the
 * only honest way to present a number like this.
 */

const COMPONENTS = [
  { label: "Availability", weight: 30, earned: 30, state: "Verified" },
  { label: "Rent", weight: 20, earned: 20, state: "Verified" },
  { label: "Parking", weight: 20, earned: 20, state: "Verified" },
  { label: "Air conditioning", weight: 15, earned: 15, state: "Verified" },
  { label: "Fees", weight: 10, earned: 5, state: "Partial" },
  { label: "Contact confidence", weight: 5, earned: 4, state: "Verified" },
] as const;

export function ScoreSection() {
  const { ref: countRef, value } = useCountUp(92, 1800);
  const { ref: barsRef, inView } = useInView<HTMLDivElement>({ threshold: 0.3 });

  return (
    <section data-nav="dark" className="relative overflow-hidden bg-void-900 py-28 lg:py-40">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 60% at 18% 40%, rgb(16 145 107 / 0.10), transparent 60%)",
        }}
      />

      <div className="relative mx-auto max-w-[1600px] px-6 lg:px-10">
        <div className="grid gap-16 lg:grid-cols-[0.85fr_1.15fr] lg:gap-24">
          {/* --- The number ---------------------------------------------------- */}
          <div ref={countRef}>
            <Reveal>
              <p className="type-info text-[10px] text-white/35">Verification score</p>
            </Reveal>

            <HoverLabel label="8 verified facts">
              <p
                className="type-display tabular mt-6 leading-[0.8] text-white"
                style={{ fontSize: "clamp(7rem, 17vw, 15rem)" }}
              >
                {value}
              </p>
            </HoverLabel>

            <Reveal delay={150}>
              <p className="type-info mt-4 text-[10px] text-verified-400">
                Verified · 8 facts confirmed · 1 discrepancy
              </p>
            </Reveal>

            <Reveal delay={220}>
              <p className="mt-10 max-w-sm text-[15px] leading-relaxed text-white/50">
                Availability is worth 30. Price accuracy 20. The amenities you actually asked for,
                20. A confirmed fact always outscores an assumed one.
              </p>
            </Reveal>
          </div>

          {/* --- The construction ---------------------------------------------- */}
          <div ref={barsRef} className="lg:pt-16">
            <ul>
              {COMPONENTS.map((component, index) => {
                const partial = component.state === "Partial";
                const ratio = component.earned / component.weight;
                return (
                  <li key={component.label} className="border-b border-white/[0.07] py-5">
                    <div className="flex items-baseline justify-between gap-6">
                      <span className="type-info text-[10px] text-white/70">
                        {component.label}
                      </span>
                      <span className="flex items-baseline gap-4">
                        <span
                          className={
                            "type-info text-[9px] " +
                            (partial ? "text-caution-400" : "text-verified-400")
                          }
                        >
                          {component.state}
                        </span>
                        <span className="type-data w-20 whitespace-nowrap text-right text-sm text-white">
                          {component.earned} / {component.weight}
                        </span>
                      </span>
                    </div>

                    {/* The rule draws to the earned proportion. */}
                    <div className="mt-3 h-px w-full bg-white/10">
                      <div
                        className={
                          "h-full origin-left transition-transform duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] " +
                          (partial ? "bg-caution-400" : "bg-verified-400")
                        }
                        style={{
                          transform: "scaleX(" + (inView ? ratio : 0) + ")",
                          transitionDelay: 240 + index * 110 + "ms",
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>

            <Reveal delay={300}>
              <p className="type-info mt-8 text-[9px] leading-loose text-white/45">
                Contradictions between the listing and the call are deducted on top. A score is
                never rounded up into a higher band.
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
