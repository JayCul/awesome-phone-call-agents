import { SearchForm } from "@/components/SearchForm";
import { Card } from "@/components/ui";
import { usingClaude, usingRealCalle } from "@/server/env";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const params = await searchParams;
  const prefillDemo = params.demo === "1";
  const live = usingRealCalle();
  const claude = usingClaude();

  return (
    <div className="mx-auto max-w-5xl px-6 py-14">
      <div className="animate-rise">
        <h1 className="text-4xl font-semibold tracking-[-0.025em] text-ink-900">
          What are you looking for?
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-600">
          Describe it in a sentence or use the filters. Propster turns it into a typed requirement,
          searches the listings, and ranks what it finds. You decide which ones get a phone call.
        </p>
      </div>

      <Card className="mt-9 p-8 animate-rise">
        <SearchForm prefillDemo={prefillDemo} />
      </Card>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <ConfigNote
          label="Requirement extraction"
          value={claude ? "Claude" : "Deterministic parser"}
          detail={
            claude
              ? "Natural language is parsed by Claude, then validated against a strict schema before use."
              : "No model key configured, so the built-in rule parser handles natural language. It reads currency symbols, millions and 'k' notation."
          }
          tone={claude ? "good" : "neutral"}
        />
        <ConfigNote
          label="Phone verification"
          value={live ? "CALL-E (live calls)" : "Demo mode (simulated calls)"}
          detail={
            live
              ? "Verification places real outbound calls through CALL-E. Every call opens by identifying itself as an AI assistant."
              : "No CALL-E key configured, so verification replays a deterministic conversation. Every simulated call is labelled as such in the UI."
          }
          tone={live ? "good" : "neutral"}
        />
      </div>
    </div>
  );
}

function ConfigNote({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "good" | "neutral";
}) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
      <div className="flex items-center gap-2">
        <span
          className={
            "h-1.5 w-1.5 rounded-full " + (tone === "good" ? "bg-verified-500" : "bg-ink-300")
          }
        />
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
          {label}
        </span>
      </div>
      <p className="mt-1.5 text-sm font-semibold text-ink-900">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-500">{detail}</p>
    </div>
  );
}
