import { Reveal } from "./motion";

/**
 * 04 — Introducing Propster.
 *
 * Almost nothing on screen. The section exists to isolate two words, and the
 * negative space around them is doing the work: after a wall of doubt, the
 * answer is short enough to fit on one line.
 */
export function PropsterIntro() {
  return (
    <section data-nav="light" className="relative overflow-hidden bg-sand-50 pb-40 lg:pb-56">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-10">
        <Reveal>
          <p className="type-info text-[10px] text-signal-600">
            This is where Propster starts
          </p>
        </Reveal>

        <h2 className="type-display size-section mt-12 max-w-[16ch] text-void-900">
          <Reveal variant="line">WE DON&apos;T STOP</Reveal>
          <Reveal variant="line" delay={90}>
            AT THE LISTING.
          </Reveal>
        </h2>

        <Reveal delay={160}>
          <p className="mt-10 max-w-xl text-[16px] leading-relaxed text-sand-600">
            Propster searches, investigates and verifies property details through real-world
            conversations.
          </p>
        </Reveal>
      </div>

      {/* --- The isolated statement ------------------------------------------ */}
      <div className="relative mt-40 lg:mt-56">
        <Reveal threshold={0.4}>
          <p
            className="type-display text-center text-void-900"
            style={{ fontSize: "clamp(4.5rem, 22vw, 22rem)", lineHeight: 0.82 }}
          >
            IT CALLS.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
