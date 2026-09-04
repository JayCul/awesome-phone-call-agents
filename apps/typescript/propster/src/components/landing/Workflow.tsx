"use client";

import { useScrollSteps } from "./motion";

/**
 * 10 — How it works.
 *
 * A single horizontal rail of six stages that advances with scroll. Each stage
 * carries a small artefact rather than an icon, so the sequence shows the
 * actual material moving through the system: a sentence becomes candidates,
 * candidates become a call, a call becomes evidence.
 *
 * The rail translates horizontally on desktop; on narrow screens it becomes a
 * vertical list, because a sideways narrative does not survive a phone.
 */

interface Stage {
  index: string;
  title: string;
  artefact: { kind: "text" | "rows" | "call" | "score"; body: string[] };
}

const STAGES: Stage[] = [
  {
    index: "01",
    title: "Search",
    artefact: {
      kind: "text",
      body: ["“2 bedroom in Lisbon", "under €1,800 with parking", "and air conditioning”"],
    },
  },
  {
    index: "02",
    title: "Discover",
    artefact: { kind: "rows", body: ["12 listings found", "6 shortlisted", "5 worth calling"] },
  },
  {
    index: "03",
    title: "Call",
    artefact: { kind: "call", body: ["CALL-E", "Dialing agent", "00:42"] },
  },
  {
    index: "04",
    title: "Verify",
    artefact: {
      kind: "rows",
      body: ["Availability ✓", "Rent ✓", "Parking ✓"],
    },
  },
  {
    index: "05",
    title: "Compare",
    artefact: { kind: "rows", body: ["Listed €1,650", "Confirmed €1,650", "+ €3,300 deposit"] },
  },
  {
    index: "06",
    title: "Decide",
    artefact: { kind: "score", body: ["92 / 100", "Verified"] },
  },
];

export function Workflow() {
  const { ref, step } = useScrollSteps<HTMLDivElement>(STAGES.length);

  return (
    <section id="how-it-works" data-nav="light" ref={ref} className="relative bg-white">
      <div className="relative h-[420svh]">
        <div className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden">
          <div className="mx-auto w-full max-w-[1600px] px-6 lg:px-10">
            <p className="type-info text-[10px] text-sand-500">How it works</p>
            <h2 className="type-display mt-6 max-w-[16ch] text-4xl text-void-900 lg:text-6xl">
              CLAIM. CALL. EVIDENCE. TRUTH.
            </h2>
          </div>

          {/* --- Desktop rail ------------------------------------------------- */}
          <div className="mt-16 hidden overflow-hidden lg:block">
            <div
              className="flex gap-8 px-10 transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ transform: "translate3d(" + -step * 27 + "vw, 0, 0)" }}
            >
              {STAGES.map((stage, index) => (
                <StageCard key={stage.index} stage={stage} active={index === step} passed={index < step} />
              ))}
            </div>

            {/* Progress rail */}
            <div className="mx-auto mt-14 flex max-w-[1600px] gap-2 px-10">
              {STAGES.map((stage, index) => (
                <span
                  key={stage.index}
                  className="h-[2px] flex-1 transition-colors duration-500"
                  style={{
                    background:
                      index <= step ? "var(--color-void-900)" : "var(--color-sand-200)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* --- Narrow: vertical, current stage only -------------------------- */}
          <div className="mt-14 px-6 lg:hidden">
            <StageCard stage={STAGES[step] ?? STAGES[0]!} active passed={false} />
            <div className="mt-8 flex gap-2">
              {STAGES.map((stage, index) => (
                <span
                  key={stage.index}
                  className="h-[2px] flex-1 transition-colors duration-500"
                  style={{
                    background:
                      index <= step ? "var(--color-void-900)" : "var(--color-sand-200)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StageCard({
  stage,
  active,
  passed,
}: {
  stage: Stage;
  active: boolean;
  passed: boolean;
}) {
  return (
    <article
      className="w-full shrink-0 transition-all duration-700 lg:w-[25vw]"
      style={{
        opacity: active ? 1 : passed ? 0.28 : 0.4,
        transform: active ? "none" : "scale(0.965)",
      }}
    >
      <div className="flex items-baseline gap-4">
        <span className="type-data text-sm text-sand-400">{stage.index}</span>
        <h3 className="type-info text-[11px] text-void-900">{stage.title}</h3>
      </div>

      <div className="mt-6 h-px w-full bg-sand-200" />

      <div className="mt-6 min-h-[132px]">
        <Artefact stage={stage} active={active} />
      </div>
    </article>
  );
}

function Artefact({ stage, active }: { stage: Stage; active: boolean }) {
  const { kind, body } = stage.artefact;

  if (kind === "text") {
    return (
      <p className="type-accent text-2xl leading-snug text-void-900 lg:text-[26px]">
        {body.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </p>
    );
  }

  if (kind === "call") {
    return (
      <div className="bg-void-900 p-5">
        <p className="type-info flex items-center gap-2 text-[10px] text-white">
          <span
            className={active ? "animate-blink h-1.5 w-1.5 rounded-full bg-verified-400" : "h-1.5 w-1.5 rounded-full bg-verified-400"}
          />
          {body[0]}
        </p>
        <p className="type-info mt-4 text-[9px] text-white/45">{body[1]}</p>
        <p className="type-data mt-2 text-2xl text-white">{body[2]}</p>
      </div>
    );
  }

  if (kind === "score") {
    return (
      <div>
        <p className="type-data text-5xl font-medium text-void-900">{body[0]}</p>
        <p className="type-info mt-3 text-[10px] text-verified-600">{body[1]}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {body.map((line) => (
        <li key={line} className="type-data text-[15px] text-void-900">
          {line}
        </li>
      ))}
    </ul>
  );
}
