"use client";

import { ART } from "./art";
import { useScrollProgress } from "./motion";

/**
 * 02/03 — The property, and then the doubt.
 *
 * This is the hinge of the whole page. It opens as a real-estate campaign and
 * ends as an intelligence readout, and it does it with one photograph: as the
 * visitor scrolls, the image desaturates and darkens, listing metadata
 * overlays it, and the confirmations resolve to NO.
 *
 * The grading is driven by scroll progress written straight to inline styles,
 * so the transition is continuous rather than a jump between two states.
 */
export function TheProperty() {
  const { ref, progress } = useScrollProgress<HTMLDivElement>();

  // Remap the raw 0→1 travel so the change happens in the middle of the
  // section, leaving clean holds at both ends.
  const t = clamp((progress - 0.28) / 0.34);

  const saturation = 0.95 - t * 0.72;
  const brightness = 1 - t * 0.42;
  const overlay = 0.12 + t * 0.62;

  return (
    <section
      ref={ref}
      // Photographic from top to bottom, so the navigation keeps its dark
      // treatment throughout. A solid light bar would read as a band cutting
      // across the image rather than as chrome floating over it.
      data-nav="dark"
      className="relative bg-sand-50"
    >
      {/* --- Sticky image stage ---------------------------------------------- */}
      <div className="relative h-[260svh]">
        <div className="sticky top-0 h-[100svh] overflow-hidden">
          <img
            src={ART.interior.src}
            srcSet={ART.interior.srcSmall + " 900w, " + ART.interior.src + " 2000w"}
            sizes="100vw"
            alt={ART.interior.alt}
            className="h-full w-full object-cover"
            style={{
              filter: "saturate(" + saturation + ") brightness(" + brightness + ") contrast(1.06)",
              transform: "scale(" + (1.06 - t * 0.06) + ")",
            }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-void-900"
            style={{ opacity: overlay }}
          />

          {/* A scan line that only exists once the investigation begins. */}
          {t > 0.45 ? (
            <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
              <div
                className="animate-scan absolute inset-x-0 h-32"
                style={{
                  background:
                    "linear-gradient(180deg, transparent, rgb(52 98 246 / 0.14), transparent)",
                }}
              />
            </div>
          ) : null}

          {/* --- Statement one: the emotional read --------------------------- */}
          <div
            className="absolute inset-0 flex items-center justify-center px-6"
            style={{
              opacity: clamp(1 - t * 2.6),
              transform: "translate3d(0," + -t * 40 + "px,0)",
            }}
          >
            <h2 className="type-display size-statement text-center text-white drop-shadow-sm">
              Beautiful listing.
            </h2>
          </div>

          {/* --- Statement two: the doubt ------------------------------------ */}
          <div
            className="absolute inset-0 flex items-center justify-center px-6"
            style={{
              opacity: clamp((t - 0.52) * 3.4),
              transform: "translate3d(0," + (1 - clamp((t - 0.52) * 3.4)) * 34 + "px,0)",
            }}
          >
            <h2 className="type-display size-statement text-center text-white">
              But is it <span className="type-accent text-signal-300">accurate</span>?
            </h2>
          </div>

          {/* --- The listing data creeping in over the photograph ------------ */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 px-6 pb-10 lg:px-10 lg:pb-14"
            style={{ opacity: clamp((t - 0.34) * 3) }}
          >
            <div className="mx-auto flex max-w-[1600px] flex-wrap items-end justify-between gap-8">
              <div className="space-y-1">
                <p className="type-info text-[9px] text-white/40">Advertised</p>
                <p className="type-data text-lg text-white">€1,650 / month</p>
              </div>
              <div className="space-y-1">
                <p className="type-info text-[9px] text-white/40">Bedrooms</p>
                <p className="type-data text-lg text-white">3</p>
              </div>
              <div className="space-y-1">
                <p className="type-info text-[9px] text-white/40">Amenities</p>
                <p className="type-data text-lg text-white">Parking · Air con</p>
              </div>
              <div className="space-y-1">
                <p className="type-info text-[9px] text-white/40">Last updated</p>
                <p className="type-data text-lg text-caution-400">21 days ago</p>
              </div>
              <div className="space-y-1">
                <p className="type-info text-[9px] text-white/40">Price confirmed</p>
                <p className="type-data text-lg text-alert-400">No</p>
              </div>
              <div className="space-y-1">
                <p className="type-info text-[9px] text-white/40">Availability confirmed</p>
                <p className="type-data text-lg text-alert-400">No</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
