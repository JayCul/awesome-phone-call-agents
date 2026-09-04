import { Reveal } from "./motion";

/**
 * 03 — The problem, stated editorially.
 *
 * One enormous statement, four short facts, and no illustration. The section
 * before it did the showing; this one only has to land the sentence.
 */
export function Problem() {
  return (
    <section data-nav="light" className="relative bg-sand-50 py-32 lg:py-48">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-10">
        <Reveal>
          <p className="type-info text-[10px] text-sand-500">The problem</p>
        </Reveal>

        <h2 className="type-display size-statement mt-10 max-w-[24ch] text-void-900">
          {["THE INTERNET IS FULL", "OF PROPERTIES THAT", "AREN'T WHAT THEY SEEM."].map(
            (line, index) => (
              <Reveal key={line} variant="line" delay={index * 90}>
                {line}
              </Reveal>
            ),
          )}
        </h2>

        <Reveal delay={120}>
          <div className="mt-16 h-px w-full origin-left bg-sand-300" />
        </Reveal>

        {/* The four ways a listing lies. Set in the information face, because
            each one is a fact about the market rather than a sales point. */}
        <div className="mt-16 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {FACTS.map((fact, index) => (
            <Reveal key={fact.title} delay={index * 90}>
              <p className="type-data text-3xl font-medium text-void-900">{fact.figure}</p>
              <p className="type-info mt-4 text-[10px] text-void-900">{fact.title}</p>
              <p className="mt-2.5 text-[14px] leading-relaxed text-sand-600">{fact.body}</p>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <p className="mt-24 max-w-2xl text-[19px] leading-relaxed text-void-900 lg:text-[22px]">
            Listings go stale. Prices change. Fees disappear into conversations.
            <span className="type-accent text-sand-500"> &ldquo;Available&rdquo;</span> doesn&apos;t
            always mean available.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

const FACTS = [
  {
    figure: "21",
    title: "Days since update",
    body: "The photographs are current. The availability is three weeks old.",
  },
  {
    figure: "+32%",
    title: "Rent moves",
    body: "The advert says €1,450. The landlord raised it after the photos.",
  },
  {
    figure: "3x",
    title: "In fees",
    body: "Deposit, agency, contract, service charge. Rarely on the listing.",
  },
  {
    figure: "0",
    title: "Parking bays",
    body: "Advertised as private parking. In practice, the street outside.",
  },
] as const;
