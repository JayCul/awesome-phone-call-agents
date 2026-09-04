import { Reveal } from "./motion";

/**
 * 12 — CALL-E.
 *
 * The visitor has already watched CALL-E work twice by the time they reach
 * this; this section only has to name it and state what it is responsible for.
 *
 * `live` reflects the server's actual configuration, so the page never claims
 * to be placing real calls when no key is present.
 */
export function CallESection({ live }: { live: boolean }) {
  return (
    <section data-nav="light" className="relative bg-white py-28 lg:py-40">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-10">
        <div className="grid gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24">
          <div>
            <Reveal>
              <p className="type-info text-[10px] text-sand-500">The voice layer</p>
            </Reveal>

            <Reveal delay={80}>
              <p
                className="type-display mt-8 leading-none text-void-900"
                style={{ fontSize: "clamp(3.5rem, 9vw, 8rem)" }}
              >
                CALL-E
              </p>
            </Reveal>

            <Reveal delay={160}>
              <p className="mt-10 max-w-md text-[16px] leading-relaxed text-sand-600">
                Propster builds the objective and validates the answers. CALL-E holds the
                conversation — it dials the number, speaks to the person who picks up, and returns
                the facts as structured data.
              </p>
            </Reveal>

            <Reveal delay={220}>
              <p
                className={
                  "type-info mt-10 inline-flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-[10px] " +
                  (live
                    ? "border-verified-500/30 bg-verified-50 text-verified-600"
                    : "border-sand-300 bg-sand-50 text-sand-600")
                }
              >
                <span
                  className={
                    "inline-block h-1.5 w-1.5 rounded-full " +
                    (live ? "animate-blink bg-verified-500" : "bg-sand-400")
                  }
                />
                {live ? "Live calling enabled" : "Demo mode · simulated calls"}
              </p>
            </Reveal>
          </div>

          {/* --- The narrative, as a chain -------------------------------------- */}
          <div className="lg:pt-10">
            {CHAIN.map((link, index) => (
              <Reveal key={link.text} delay={index * 80}>
                <div>
                  <div className="flex items-baseline gap-6 py-3">
                    <span className="type-data w-8 shrink-0 text-sm text-sand-400">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={
                        "text-[17px] leading-snug lg:text-[20px] " +
                        (link.emphasis ? "text-void-900" : "text-sand-600")
                      }
                    >
                      {link.text}
                    </span>
                  </div>
                  {index < CHAIN.length - 1 ? (
                    <div className="ml-4 h-5 w-px bg-sand-300" aria-hidden="true" />
                  ) : null}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const CHAIN = [
  { text: "I found a property.", emphasis: false },
  { text: "But can I trust it?", emphasis: false },
  { text: "Propster investigates.", emphasis: true },
  { text: "CALL-E makes the call.", emphasis: true },
  { text: "The agent answers.", emphasis: false },
  { text: "Propster extracts the facts.", emphasis: true },
  { text: "Propster finds the discrepancies.", emphasis: true },
  { text: "I get verified information.", emphasis: true },
] as const;
