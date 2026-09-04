"use client";

import { HoverLabel, Reveal } from "./motion";
import { ART } from "./art";

/**
 * 07 — Every answer has a source.
 *
 * Evidence fragments are scattered around a central property rather than
 * arranged in a grid, so the section reads as a dossier laid out on a desk.
 * Positions are hand-placed per fragment; on narrow screens they collapse to a
 * legible stack rather than being squeezed into the same composition.
 */

interface Fragment {
  field: string;
  value: string;
  source: string;
  note?: string;
  confidence?: string;
  tone: "confirmed" | "found";
  /** Desktop placement, as percentages of the stage. */
  at: { top: string; left?: string; right?: string };
  drift?: boolean;
}

const FRAGMENTS: Fragment[] = [
  {
    field: "Monthly rent",
    value: "€1,650",
    source: "Phone verification",
    confidence: "96% confidence",
    tone: "confirmed",
    at: { top: "6%", left: "0%" },
    drift: true,
  },
  {
    field: "Parking",
    value: "Dedicated",
    source: "Phone verification",
    tone: "confirmed",
    at: { top: "40%", left: "-2%" },
  },
  {
    field: "Availability",
    value: "Confirmed",
    source: "Phone verification",
    confidence: "Contact spoke directly",
    tone: "confirmed",
    at: { top: "72%", left: "6%" },
    drift: true,
  },
  {
    field: "Deposit",
    value: "€3,300",
    source: "Discovered during call",
    note: "Not present in the listing",
    tone: "found",
    at: { top: "14%", right: "0%" },
    drift: true,
  },
  {
    field: "Air conditioning",
    value: "Both bedrooms",
    source: "Phone verification",
    tone: "confirmed",
    at: { top: "48%", right: "-2%" },
  },
  {
    field: "Earliest move-in",
    value: "Immediately",
    source: "Phone verification",
    tone: "confirmed",
    at: { top: "78%", right: "5%" },
  },
];

export function Evidence() {
  return (
    <section data-nav="light" className="relative overflow-hidden bg-sand-50 py-28 lg:py-40">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-10">
        <Reveal>
          <p className="type-info text-[10px] text-sand-500">The evidence</p>
        </Reveal>

        <h2 className="type-display size-section mt-10 max-w-[14ch] text-void-900">
          <Reveal variant="line">EVERY ANSWER</Reveal>
          <Reveal variant="line" delay={90}>
            HAS A SOURCE.
          </Reveal>
        </h2>

        {/* --- Desktop: the scattered dossier ------------------------------- */}
        <div className="relative mt-24 hidden min-h-[760px] lg:block">
          {/* Centre subject */}
          <div className="absolute left-1/2 top-1/2 w-[330px] -translate-x-1/2 -translate-y-1/2">
            <Reveal variant="image">
              <HoverLabel label="Investigate →">
                <div className="relative aspect-[3/4] overflow-hidden">
                  <img
                    src={ART.listing.srcSmall}
                    alt={ART.listing.alt}
                    className="h-full w-full object-cover grade-property"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-void-900/80 to-transparent p-5">
                    <p className="type-info text-[9px] text-white/60">Property #04</p>
                    <p className="type-data mt-1 text-sm text-white">Príncipe Real, Lisbon</p>
                  </div>
                </div>
              </HoverLabel>
            </Reveal>
          </div>

          {/* Fragments */}
          {FRAGMENTS.map((fragment, index) => (
            <div
              key={fragment.field}
              className="absolute w-[268px]"
              style={{ top: fragment.at.top, left: fragment.at.left, right: fragment.at.right }}
            >
              <Reveal delay={index * 110}>
                <div className={fragment.drift ? "animate-drift" : undefined}>
                  <FragmentCard fragment={fragment} />
                </div>
              </Reveal>
            </div>
          ))}
        </div>

        {/* --- Mobile and tablet: a legible stack --------------------------- */}
        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:hidden">
          {FRAGMENTS.map((fragment, index) => (
            <Reveal key={fragment.field} delay={index * 70}>
              <FragmentCard fragment={fragment} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FragmentCard({ fragment }: { fragment: Fragment }) {
  const found = fragment.tone === "found";
  return (
    <HoverLabel label="View source →">
      <article
        className={
          "border-l-2 bg-white/70 p-6 backdrop-blur-sm transition-shadow duration-500 hover:shadow-[0_18px_50px_-24px_rgb(12_14_18/0.35)] " +
          (found ? "border-caution-500" : "border-verified-500")
        }
      >
        <p className="type-info text-[9px] text-sand-500">{fragment.field}</p>
        <p className="type-data mt-3 text-2xl font-medium text-void-900">{fragment.value}</p>

        <div className="mt-5 h-px w-full bg-sand-200" />

        <p className="type-info mt-4 text-[9px] text-sand-500">Source</p>
        <p
          className={
            "type-info mt-1 text-[10px] " + (found ? "text-caution-600" : "text-verified-600")
          }
        >
          {fragment.source}
        </p>

        {fragment.confidence ? (
          <p className="type-info mt-3 text-[9px] text-sand-400">{fragment.confidence}</p>
        ) : null}
        {fragment.note ? (
          <p className="type-info mt-3 text-[9px] text-caution-600">{fragment.note}</p>
        ) : null}
      </article>
    </HoverLabel>
  );
}
