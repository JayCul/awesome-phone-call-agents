"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ART } from "./art";
import { prefersReducedMotion } from "./motion";

/**
 * 01 — Immersive hero.
 *
 * A full-bleed architectural photograph with the headline set as the dominant
 * object on screen. The load choreography is a fixed sequence rather than
 * scroll-driven, because it plays once, on arrival:
 *
 *   image wipe → nav → metadata → headline, line by line → copy → CTA → dossier
 *
 * The floating dossier card is the first hint that this is not a listings
 * site: it reads UNVERIFIED, and it is the only element on the first screen
 * set in the information typeface.
 */

/**
 * Headline candidates were set at final size before choosing. This one wins on
 * typography: two lines of near-equal measure that stack into a clean block at
 * every breakpoint, with the turn landing on "REAL" — the word the product is
 * actually about. The alternates ("LISTINGS ARE CLAIMS", "THE PROPERTY SEARCH
 * THAT CHECKS BACK") are used later on the page, where they read as follow-up
 * rather than as an opening claim.
 */
const HEADLINE = ["FIND THE", "PROPERTY.", "THEN FIND OUT", "IF IT'S REAL."] as const;

export function Hero() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setStage(9);
      return;
    }
    // Each entry is the delay before that stage appears.
    const marks = [80, 420, 620, 780, 920, 1060, 1320, 1560];
    const timers = marks.map((delay, index) =>
      setTimeout(() => setStage(index + 1), delay),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const shown = (at: number) => (stage >= at ? "is-visible" : "");

  return (
    <section
      data-nav="dark"
      className="relative flex min-h-[100svh] flex-col overflow-hidden bg-void-900"
    >
      {/* --- The photograph -------------------------------------------------- */}
      <div className="absolute inset-0">
        <img
          src={ART.hero.src}
          srcSet={ART.hero.srcSmall + " 900w, " + ART.hero.src + " 2000w"}
          sizes="100vw"
          alt={ART.hero.alt}
          fetchPriority="high"
          className={"reveal-image grade-property h-full w-full object-cover " + shown(1)}
        />
        {/* Legibility treatment. Kept deliberately light: the architecture has
            to stay readable as architecture, so the type earns its contrast
            from a bottom-weighted scrim rather than from dimming the frame. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgb(12 14 18 / 0.58) 0%, rgb(12 14 18 / 0.10) 26%, rgb(12 14 18 / 0.38) 64%, rgb(12 14 18 / 0.84) 100%)",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(100deg, rgb(12 14 18 / 0.52) 0%, rgb(12 14 18 / 0.10) 42%, transparent 70%)",
          }}
        />
      </div>

      {/* --- Content --------------------------------------------------------- */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-6 pb-10 pt-[104px] lg:px-10 lg:pb-14">
        {/* Metadata */}
        <div
          className={"reveal " + shown(3)}
          style={{ ["--reveal-delay" as string]: "0ms" }}
        >
          <p className="type-info text-[10px] text-white">Property intelligence</p>
          <p className="type-info mt-1.5 text-[10px] text-white/55">Wherever you are renting</p>
        </div>

        {/* Headline. Sits low in the frame so the upper two thirds stay
            photograph, which is what makes the first screen read as a property
            campaign rather than a product page. */}
        <h1 className="type-display size-hero mt-auto max-w-[14ch] text-white">
          {HEADLINE.map((line, index) => {
            const isFinal = line === "IF IT'S REAL.";
            return (
              <span
                key={line}
                className={"reveal-line " + shown(4 + Math.min(index, 2))}
                style={{ ["--reveal-delay" as string]: index * 95 + "ms" }}
              >
                {/* The turn of the whole page lands on "REAL", so it is the
                    only word carrying the accent colour. */}
                <span>
                  {isFinal ? (
                    <>
                      IF IT&apos;S <span className="text-signal-300">REAL.</span>
                    </>
                  ) : (
                    line
                  )}
                </span>
              </span>
            );
          })}
        </h1>

        {/* Supporting copy + actions */}
        <div className="mt-10 flex flex-col gap-8 lg:mt-14 lg:flex-row lg:items-end lg:justify-between">
          <div
            className={"reveal max-w-md " + shown(6)}
            style={{ ["--reveal-delay" as string]: "0ms" }}
          >
            <p className="text-[16px] leading-relaxed text-white/80">
              Propster searches listings, then calls the agent to confirm what is actually true
              about them.
            </p>
          </div>

          <div
            className={"reveal flex flex-wrap items-center gap-3 " + shown(7)}
            style={{ ["--reveal-delay" as string]: "0ms" }}
          >
            <Link
              href="/search"
              className="type-info group inline-flex h-13 items-center gap-3 rounded-full bg-white px-7 py-4 text-[10px] text-void-900 transition-transform duration-300 hover:scale-[1.02]"
            >
              Start an investigation
              <span
                aria-hidden="true"
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
            <Link
              href="/try"
              className="type-info group inline-flex h-13 items-center gap-3 rounded-full border border-white/40 px-7 py-4 text-[10px] text-white transition-colors duration-300 hover:border-white hover:bg-white/10"
            >
              Have Propster call my phone
              <span
                aria-hidden="true"
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* --- The floating dossier ------------------------------------------- */}
      <aside
        className={
          "reveal absolute right-6 top-1/2 z-10 hidden w-[218px] -translate-y-1/2 lg:right-10 xl:block " +
          shown(8)
        }
        style={{ ["--reveal-delay" as string]: "0ms" }}
      >
        <div className="animate-drift border border-white/20 bg-void-900/75 p-5 backdrop-blur-xl">
          <p className="type-info text-[9px] text-white/40">Property #04</p>

          <p className="mt-4 text-[15px] leading-tight text-white">Príncipe Real, Lisbon</p>

          <p className="type-data mt-3 text-2xl font-medium text-white">€1,650</p>
          <p className="type-info mt-0.5 text-[9px] text-white/40">per month</p>

          <div className="mt-5 h-px w-full bg-white/15" />

          <p className="type-info mt-4 text-[9px] text-white/40">Status</p>
          <p className="type-info mt-1 flex items-center gap-2 text-[10px] text-caution-400">
            <span className="animate-blink inline-block h-1.5 w-1.5 rounded-full bg-caution-400" />
            Unverified
          </p>
        </div>
      </aside>

      {/* --- Scroll cue ------------------------------------------------------ */}
      <div
        className={"reveal absolute bottom-8 right-6 z-10 hidden lg:right-10 lg:block " + shown(8)}
      >
        <p className="type-info flex items-center gap-3 text-[9px] text-white/35">
          Scroll
          <span className="block h-8 w-px bg-gradient-to-b from-white/50 to-transparent" />
        </p>
      </div>
    </section>
  );
}
