import { TestPropertyForm } from "@/components/TestPropertyForm";
import { Card } from "@/components/ui";
import { usingRealCalle } from "@/server/env";

export const dynamic = "force-dynamic";

/**
 * "Try it on a real property".
 *
 * The demo corpus is fictional, so the strongest possible demonstration is
 * letting someone put their own number in and be called. This page exists for
 * that: describe a listing, then play the agent when the phone rings.
 */
export default function TryPage() {
  const live = usingRealCalle();

  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <div className="animate-rise">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
          Try it yourself
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.025em] text-ink-900">
          Let Propster call you.
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-600">
          Describe a property, give your own number, and Propster will phone you and ask about it.
          You play the letting agent. Answer however you like — the point is that whatever you say
          on the call is what gets checked against the listing you wrote.
        </p>
      </div>

      <div
        className={
          "mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-3 text-[13px] " +
          (live
            ? "border-verified-500/25 bg-verified-50 text-verified-600"
            : "border-[var(--border-subtle)] bg-ink-50 text-ink-600")
        }
      >
        <span
          className={"h-1.5 w-1.5 rounded-full " + (live ? "bg-verified-500" : "bg-ink-400")}
        />
        <span className="font-semibold">
          {live ? "Live calling is on" : "Demo mode: no call will be placed"}
        </span>
        <span className={live ? "text-verified-600/80" : "text-ink-500"}>
          {live
            ? "Your phone will ring. The agent opens by identifying itself as an AI, never negotiates, and hangs up when you ask it to."
            : "No CALL-E key is configured, so verification will replay a deterministic conversation instead of dialling."}
        </span>
      </div>

      <Card className="mt-6 p-8 animate-rise">
        <TestPropertyForm live={live} />
      </Card>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <Step
          n="01"
          title="Write the listing"
          body="Set a rent, a bedroom count and some amenities. These become the claims under test."
        />
        <Step
          n="02"
          title="Answer the call"
          body="Contradict the listing on purpose. Quote a different rent, or deny the parking."
        />
        <Step
          n="03"
          title="See the discrepancies"
          body="Propster scores what you said against what the listing claimed, and shows every gap."
        />
      </section>

      <p className="mt-10 text-xs leading-relaxed text-ink-400">
        The number you enter is used only to place this one verification call and is stored with the
        listing you created. Do not enter someone else&apos;s number.
      </p>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="border-t-2 border-ink-900 pt-3.5">
      <span className="tabular text-[11px] font-semibold tracking-[0.14em] text-ink-400">{n}</span>
      <h3 className="mt-1.5 text-sm font-semibold text-ink-900">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">{body}</p>
    </div>
  );
}
