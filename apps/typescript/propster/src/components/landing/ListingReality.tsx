"use client";

import { ART } from "./art";
import { Reveal, useInView } from "./motion";

/**
 * 08 — Listing → reality.
 *
 * An editorial split. The left side is the advert, fixed and flat. The right
 * side assembles itself as the visitor arrives, one confirmed fact at a time,
 * ending on the cost the listing never mentioned.
 *
 * The closing line is the page's thesis in eight words, so it is set at
 * statement scale and given a screen of its own.
 */

const CLAIMS = [
  { label: "Monthly rent", value: "€1,650" },
  { label: "Bedrooms", value: "2" },
  { label: "Parking", value: "Included" },
  { label: "Air conditioning", value: "Included" },
] as const;

const VERIFIED = [
  { label: "Monthly rent", value: "€1,650", tone: "confirmed" },
  { label: "Bedrooms", value: "2", tone: "confirmed" },
  { label: "Parking", value: "Dedicated bay", tone: "confirmed" },
  { label: "Air conditioning", value: "In both rooms", tone: "confirmed" },
  { label: "Deposit", value: "€3,300", tone: "found" },
  { label: "Agency fee", value: "€1,650", tone: "found" },
  { label: "Contract fee", value: "€250", tone: "found" },
] as const;

export function ListingReality() {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.25 });

  return (
    <section data-nav="light" className="relative bg-white py-28 lg:py-40">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-10">
        <div ref={ref} className="grid gap-14 lg:grid-cols-2 lg:gap-24">
          {/* --- The listing --------------------------------------------------- */}
          <div>
            <Reveal>
              <p className="type-info text-[10px] text-sand-500">The listing</p>
            </Reveal>

            <Reveal variant="image" delay={100} className="mt-8">
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={ART.listing.src}
                  srcSet={ART.listing.srcSmall + " 900w, " + ART.listing.src + " 2000w"}
                  sizes="(max-width: 1024px) 100vw, 46vw"
                  alt={ART.listing.alt}
                  className="h-full w-full object-cover grade-property"
                />
              </div>
            </Reveal>

            <ul className="mt-10">
              {CLAIMS.map((claim, index) => (
                <Reveal key={claim.label} delay={index * 70}>
                  <li className="flex items-baseline justify-between gap-6 border-b border-sand-200 py-4">
                    <span className="type-info text-[10px] text-sand-500">{claim.label}</span>
                    <span className="type-data text-base text-void-900">{claim.value}</span>
                  </li>
                </Reveal>
              ))}
            </ul>

            <Reveal delay={220}>
              <p className="type-info mt-6 text-[9px] text-sand-400">
                Claimed · unverified · last updated 21 days ago
              </p>
            </Reveal>
          </div>

          {/* --- Verified reality ---------------------------------------------- */}
          <div className="lg:pt-14">
            <Reveal>
              <p className="type-info text-[10px] text-verified-600">Verified reality</p>
            </Reveal>

            <ul className="mt-8 border-t border-sand-200">
              {VERIFIED.map((row, index) => {
                const found = row.tone === "found";
                // Each row draws itself in sequence once the block is in view,
                // so the right side visibly *accumulates* against the left.
                return (
                  <li
                    key={row.label}
                    className="flex items-baseline justify-between gap-6 border-b border-sand-200 py-4 transition-all duration-700"
                    style={{
                      opacity: inView ? 1 : 0,
                      transform: inView ? "none" : "translate3d(18px,0,0)",
                      transitionDelay: 200 + index * 130 + "ms",
                    }}
                  >
                    <span className="type-info text-[10px] text-sand-500">{row.label}</span>
                    <span className="flex items-center gap-3">
                      <span
                        className={
                          "type-data text-base " + (found ? "text-caution-600" : "text-void-900")
                        }
                      >
                        {row.value}
                      </span>
                      {found ? (
                        <span className="type-info text-[9px] text-caution-600">Found</span>
                      ) : (
                        <svg
                          viewBox="0 0 16 16"
                          className="h-3.5 w-3.5 text-verified-500"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="m3.5 8.5 3 3 6-7"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div
              className="mt-10 flex items-baseline justify-between gap-6 transition-all duration-700"
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? "none" : "translate3d(18px,0,0)",
                transitionDelay: "1180ms",
              }}
            >
              <span className="type-info text-[10px] text-void-900">Real first-year cost</span>
              <span className="type-data text-3xl font-medium text-void-900">€25,000</span>
            </div>
          </div>
        </div>

        {/* --- The signature line -------------------------------------------- */}
        <div className="mt-36 lg:mt-52">
          <Reveal threshold={0.4}>
            <p className="type-display size-section mx-auto max-w-[20ch] text-center text-void-900">
              The listing didn&apos;t change.
              <br />
              <span className="type-accent text-signal-600">Your understanding did.</span>
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
