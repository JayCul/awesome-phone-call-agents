import Link from "next/link";
import { ART } from "./art";
import { Reveal } from "./motion";

/**
 * 13 — Final call to action, and the footer.
 *
 * Closes the way the page opened: one architectural photograph, graded dark,
 * with the headline as the dominant object. The hero asked a question; this
 * answers it.
 */
export function FinalCTA() {
  return (
    <section data-nav="dark" className="relative isolate overflow-hidden bg-void-900">
      {/* --- Image ------------------------------------------------------------ */}
      <div className="absolute inset-0 -z-10">
        <img
          src={ART.finale.src}
          srcSet={ART.finale.srcSmall + " 900w, " + ART.finale.src + " 2000w"}
          sizes="100vw"
          alt={ART.finale.alt}
          className="h-full w-full object-cover grade-investigation"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgb(12 14 18 / 0.86) 0%, rgb(12 14 18 / 0.72) 45%, rgb(12 14 18 / 0.94) 100%)",
          }}
        />
      </div>

      <div className="mx-auto flex min-h-[100svh] max-w-[1600px] flex-col justify-center px-6 py-32 lg:px-10">
        <Reveal>
          <p className="type-info text-[10px] text-white/45">Property intelligence</p>
        </Reveal>

        <h2 className="type-display size-statement mt-12 max-w-[20ch] text-white">
          {["BEFORE YOU", "BOOK THE VIEWING,", "LET PROPSTER", "MAKE THE CALL."].map(
            (line, index) => (
              <Reveal key={line} variant="line" delay={index * 90}>
                {line}
              </Reveal>
            ),
          )}
        </h2>

        <Reveal delay={200}>
          <p className="mt-12 max-w-lg text-[17px] leading-relaxed text-white/60">
            Search less. Verify more. Decide with evidence.
          </p>
        </Reveal>

        <Reveal delay={260}>
          <div className="mt-14 flex flex-wrap items-center gap-3">
            <Link
              href="/search"
              className="type-info group inline-flex items-center gap-3 rounded-full bg-white px-8 py-4.5 text-[10px] text-void-900 transition-transform duration-300 hover:scale-[1.02]"
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
              className="type-info group inline-flex items-center gap-3 rounded-full border border-white/40 px-8 py-4.5 text-[10px] text-white transition-colors duration-300 hover:border-white hover:bg-white/10"
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
        </Reveal>
      </div>

      {/* --- Footer ----------------------------------------------------------- */}
      <footer className="relative border-t border-white/10">
        <div className="mx-auto max-w-[1600px] px-6 py-12 lg:px-10">
          <div className="flex flex-wrap items-start justify-between gap-10">
            <div>
              <p className="type-info text-[13px] tracking-[0.28em] text-white">PROPSTER</p>
              <p className="type-info mt-3 text-[9px] text-white/35">
                Listings are claims. Propster verifies them.
              </p>
            </div>

            <nav className="flex flex-wrap gap-x-10 gap-y-3">
              <a href="#how-it-works" className="type-info text-[9px] text-white/45">
                How it works
              </a>
              <a href="#use-cases" className="type-info text-[9px] text-white/45">
                Use cases
              </a>
              <a href="#verification" className="type-info text-[9px] text-white/45">
                Verification
              </a>
              <Link href="/try" className="type-info text-[9px] text-white">
                Call my phone →
              </Link>
            </nav>
          </div>

          <p className="mt-14 max-w-3xl text-[11px] leading-relaxed text-white/40">
            Propster is a hackathon demonstration. All listings, agents, contact numbers and asking
            prices shown here are fictional demo data and do not represent real properties.
            Verification calls are placed by an AI agent that identifies itself as such at the start
            of every call, and never negotiates or commits on a caller&apos;s behalf.
          </p>
        </div>
      </footer>
    </section>
  );
}
