import { ART } from "./art";
import { HoverLabel, Reveal } from "./motion";

/**
 * 09 — Use cases.
 *
 * Three full-width editorial spreads rather than a card grid. Each alternates
 * side, and the third abandons imagery entirely for a typographic sum, because
 * the point it makes is arithmetic.
 */
export function UseCases() {
  return (
    <section id="use-cases" data-nav="light" className="relative bg-sand-50 py-28 lg:py-40">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-10">
        <Reveal>
          <p className="type-info text-[10px] text-sand-500">Use cases</p>
        </Reveal>

        <h2 className="type-display size-section mt-10 max-w-[26ch] text-void-900">
          <Reveal variant="line">ONE AGENT.</Reveal>
          <Reveal variant="line" delay={90}>
            MANY PROPERTY DECISIONS.
          </Reveal>
        </h2>
      </div>

      {/* --- 01: Find a home ------------------------------------------------- */}
      <div className="mx-auto mt-28 max-w-[1600px] px-6 lg:mt-40 lg:px-10">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <Reveal variant="image">
            <HoverLabel label="Investigate →">
              <div className="relative aspect-[5/4] overflow-hidden">
                <img
                  src={ART.useFind.src}
                  srcSet={ART.useFind.srcSmall + " 900w, " + ART.useFind.src + " 2000w"}
                  sizes="(max-width: 1024px) 100vw, 46vw"
                  alt={ART.useFind.alt}
                  className="h-full w-full object-cover grade-property"
                />
              </div>
            </HoverLabel>
          </Reveal>

          <div>
            <Reveal>
              <p className="type-info text-[10px] text-sand-400">Use case 01</p>
            </Reveal>
            <Reveal delay={80}>
              <h3 className="type-display mt-5 text-4xl text-void-900 lg:text-6xl">
                FIND A HOME
              </h3>
            </Reveal>
            <Reveal delay={140}>
              <p className="mt-6 max-w-md text-[16px] leading-relaxed text-sand-600">
                Tell Propster what you&apos;re looking for. It finds candidates and verifies the
                strongest ones.
              </p>
            </Reveal>

            <Reveal delay={200}>
              <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3">
                {["2 bedroom", "Lisbon", "≤ €1,800", "Parking", "Air con"].map((chip) => (
                  <span key={chip} className="type-info text-[10px] text-void-900">
                    {chip}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </div>

      {/* --- 02: Verify before you view -------------------------------------- */}
      <div className="mx-auto mt-28 max-w-[1600px] px-6 lg:mt-44 lg:px-10">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div className="lg:order-2">
            <Reveal>
              <p className="type-info text-[10px] text-sand-400">Use case 02</p>
            </Reveal>
            <Reveal delay={80}>
              <h3 className="type-display mt-5 text-4xl text-void-900 lg:text-6xl">
                VERIFY BEFORE
                <br />
                YOU VIEW
              </h3>
            </Reveal>
            <Reveal delay={140}>
              <p className="mt-6 max-w-md text-[16px] leading-relaxed text-sand-600">
                Don&apos;t drive across the city for a property that was rented two weeks ago.
              </p>
            </Reveal>

            {/* The three-beat sequence, set as a vertical chain. */}
            <Reveal delay={200}>
              <div className="mt-10 space-y-0">
                {[
                  { label: "Listing", value: "Available", tone: "claim" },
                  { label: "Call", value: "CALL-E verifies", tone: "act" },
                  { label: "Verified", value: "Available", tone: "fact" },
                ].map((step, index, all) => (
                  <div key={step.label}>
                    <div className="flex items-baseline justify-between gap-6 py-3">
                      <span className="type-info text-[10px] text-sand-400">{step.label}</span>
                      <span
                        className={
                          "type-data text-base " +
                          (step.tone === "fact"
                            ? "text-verified-600"
                            : step.tone === "act"
                              ? "text-signal-600"
                              : "text-void-900")
                        }
                      >
                        {step.value}
                      </span>
                    </div>
                    {index < all.length - 1 ? (
                      <div className="ml-0 h-6 w-px bg-sand-300" aria-hidden="true" />
                    ) : null}
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          <Reveal variant="image" className="lg:order-1">
            <HoverLabel label="Investigate →">
              <div className="relative aspect-[5/4] overflow-hidden">
                <img
                  src={ART.useVerify.src}
                  srcSet={ART.useVerify.srcSmall + " 900w, " + ART.useVerify.src + " 2000w"}
                  sizes="(max-width: 1024px) 100vw, 46vw"
                  alt={ART.useVerify.alt}
                  className="h-full w-full object-cover grade-property"
                />
              </div>
            </HoverLabel>
          </Reveal>
        </div>
      </div>

      {/* --- 03: Know the real cost ------------------------------------------ */}
      <div className="mx-auto mt-28 max-w-[1600px] px-6 lg:mt-44 lg:px-10">
        <Reveal>
          <p className="type-info text-[10px] text-sand-400">Use case 03</p>
        </Reveal>
        <Reveal delay={80}>
          <h3 className="type-display mt-5 text-4xl text-void-900 lg:text-6xl">
            KNOW THE REAL COST
          </h3>
        </Reveal>

        {/* No card, no chart. Just the sum. */}
        <div className="mt-16 max-w-3xl">
          {COSTS.map((cost, index) => (
            <Reveal key={cost.label} delay={index * 90}>
              <div className="flex items-baseline justify-between gap-8 py-5">
                <span className="type-info text-[10px] text-sand-500">{cost.label}</span>
                <span
                  className={
                    "type-data text-3xl font-medium lg:text-5xl " +
                    (cost.hidden ? "text-caution-600" : "text-void-900")
                  }
                >
                  {cost.value}
                </span>
              </div>
            </Reveal>
          ))}

          <Reveal delay={400}>
            <div className="mt-4 h-px w-full origin-left bg-void-900" />
          </Reveal>

          <Reveal delay={460}>
            <div className="flex items-baseline justify-between gap-8 pt-7">
              <span className="type-info text-[10px] text-void-900">Real cost</span>
              <span className="type-data text-4xl font-medium text-void-900 lg:text-7xl">
                €25,000
              </span>
            </div>
          </Reveal>
        </div>

        <Reveal delay={520}>
          <p className="type-display mt-20 max-w-[22ch] text-3xl leading-tight text-void-900 lg:text-5xl">
            The number on the listing isn&apos;t always the number you need.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

const COSTS = [
  { label: "Rent, one year", value: "€19,800", hidden: false },
  { label: "Deposit", value: "+ €3,300", hidden: true },
  { label: "Agency fee", value: "+ €1,650", hidden: true },
  { label: "Contract fee", value: "+ €250", hidden: true },
] as const;
