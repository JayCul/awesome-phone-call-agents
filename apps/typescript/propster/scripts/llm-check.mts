/**
 * Finds the best model available on the configured key, by measurement.
 *
 *   npm run llm:check
 *
 * Discovers which models the key can reach, then grades each one against the
 * REAL noisy transcript captured from a live CALL-E call, on nine facts a human
 * can verify from the recording. It prints the cheapest model that scores full
 * marks, ready to paste into .env.
 *
 * The point is not to argue about which model is smart enough. It is to run the
 * hardest real input we have through each candidate and look at the result.
 */
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import {
  callVerificationResultSchema,
  buildCallResultJsonSchema,
} from "../src/domain/schemas.js";
import type { TranscriptTurn } from "../src/domain/types.js";

const groqKey = (process.env.GROQ_API_KEY ?? "").trim();
const anthropicKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
const groqBase = (process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1").replace(/\/+$/, "");

if (!groqKey && !anthropicKey) {
  console.log("No GROQ_API_KEY or ANTHROPIC_API_KEY set. Add one to .env and re-run.");
  process.exit(0);
}

/** Ground truth, read off the recording of the live call by a human. */
const EXPECTED = {
  current_rent: 10_000_000,
  rent_period: "monthly",
  bedrooms: 5,
  bathrooms: 5,
} as const;

const turns = JSON.parse(
  readFileSync("tests/fixtures/live-call-transcript.json", "utf8"),
) as TranscriptTurn[];

const transcript = turns
  .map((t) => (t.speaker === "agent" ? "ASSISTANT: " : "CONTACT: ") + t.text.trim())
  .filter((line) => line.length > 12)
  .join("\n");

const SYSTEM = [
  "You extract structured facts from a phone call transcript.",
  "An AI assistant called a Nigerian property agent to verify a rental listing.",
  "Report ONLY what the CONTACT said. The transcript is noisy speech recognition;",
  'correct obvious phonetic errors ("preparing me sir" -> a prepaid meter is present).',
  "Unanswered questions are null. Never copy the listing's own values.",
  "Report the rent period the contact stated; do not convert between periods.",
  "If the contact corrected themselves, use the corrected value.",
  "Return ONLY a JSON object matching this schema:",
  JSON.stringify(buildCallResultJsonSchema()),
].join("\n");

const USER =
  "Listing under test (claims, not answers): 7500000 per year, 3 bedrooms, 3 bathrooms.\n\n" +
  "--- TRANSCRIPT ---\n" +
  transcript +
  "\n--- END ---";

function parseJson(text: string | null): unknown {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const a = cleaned.indexOf("{");
  const b = cleaned.lastIndexOf("}");
  if (a === -1 || b <= a) return null;
  try {
    return JSON.parse(cleaned.slice(a, b + 1));
  } catch {
    return null;
  }
}

async function callGroq(model: string): Promise<string | null> {
  const response = await fetch(groqBase + "/chat/completions", {
    method: "POST",
    headers: { authorization: "Bearer " + groqKey, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: USER },
      ],
    }),
  });
  if (!response.ok) throw new Error(response.status + ": " + (await response.text()).slice(0, 120));
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return payload.choices?.[0]?.message?.content ?? null;
}

async function callAnthropic(model: string): Promise<string | null> {
  const client = new Anthropic({ apiKey: anthropicKey });
  const response = await client.messages.create({
    model,
    max_tokens: 1500,
    temperature: 0,
    system: SYSTEM,
    messages: [{ role: "user", content: USER }],
  });
  const block = response.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : null;
}

/** Ask Groq which models this key can actually use. */
async function discoverGroqModels(): Promise<string[]> {
  const response = await fetch(groqBase + "/models", {
    headers: { authorization: "Bearer " + groqKey },
  });
  if (!response.ok) {
    throw new Error(response.status + ": " + (await response.text()).slice(0, 160));
  }
  const payload = (await response.json()) as { data?: Array<{ id?: string }> };
  return (payload.data ?? [])
    .map((m) => m.id)
    .filter((id): id is string => typeof id === "string")
    // Audio and guard models cannot do this task; do not waste calls on them.
    .filter((id) => !/whisper|tts|guard|prompt-?guard|embedding|orpheus|playai|speech/i.test(id))
    .sort();
}

interface Grade {
  provider: string;
  model: string;
  ok: boolean;
  note: string;
  passed: number;
  total: number;
  failures: string[];
  ms?: number;
  /** Set when the request itself failed rather than the answer being wrong. */
  transportError?: boolean;
}

/**
 * How many times each model is graded, and how long to wait between calls.
 *
 * A single run is not evidence. An earlier version of this script ran once per
 * model and ranked on latency; back-to-back calls tripped Groq's rate limit and
 * the resulting HTTP 429s were indistinguishable from wrong answers, which made
 * three perfectly good models look broken. Repeat, space the calls out, and
 * count transport failures separately from incorrect extractions.
 */
const RUNS_PER_MODEL = 3;
const SPACING_MS = 2500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function grade(provider: "groq" | "anthropic", model: string): Promise<Grade> {
  const started = Date.now();
  let text: string | null;
  try {
    text = provider === "groq" ? await callGroq(model) : await callAnthropic(model);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      provider,
      model,
      ok: false,
      note: message.slice(0, 100),
      passed: 0,
      total: 0,
      failures: [],
      // 429 and friends say nothing about the model's ability.
      transportError: /\b(429|5\d\d|rate.?limit|timeout|ECONN)/i.test(message),
    };
  }
  const ms = Date.now() - started;

  const parsed = callVerificationResultSchema.safeParse(parseJson(text));
  if (!parsed.success) {
    return {
      provider,
      model,
      ok: true,
      note: "output failed schema validation",
      passed: 0,
      total: 9,
      failures: ["schema"],
      ms,
    };
  }

  const f = parsed.data;
  const failures: string[] = [];
  let passed = 0;
  let total = 0;
  const check = (name: string, ok: boolean, got: unknown) => {
    total += 1;
    if (ok) passed += 1;
    else failures.push(name + "=" + JSON.stringify(got));
  };

  check("reached_contact", f.reached_contact === true, f.reached_contact);
  check("available", f.property_available === true, f.property_available);
  check("rent", f.current_rent === EXPECTED.current_rent, f.current_rent);
  check("period", f.rent_period === EXPECTED.rent_period, f.rent_period);
  check("bedrooms", f.bedrooms === EXPECTED.bedrooms, f.bedrooms);
  check("bathrooms", f.bathrooms === EXPECTED.bathrooms, f.bathrooms);
  check(
    "prepaid",
    typeof f.electricity_type === "string" && /prepaid/i.test(f.electricity_type),
    f.electricity_type,
  );
  // Nothing was said about these. Inventing them is a failure, not a bonus.
  check("no_invented_agency_fee", (f.agency_fee ?? null) === null, f.agency_fee);
  check("no_invented_caution_fee", (f.caution_fee ?? null) === null, f.caution_fee);

  return { provider, model, ok: true, note: "", passed, total, failures, ms };
}

// ---------------------------------------------------------------------------

const candidates: Array<{ provider: "groq" | "anthropic"; model: string }> = [];

if (groqKey) {
  try {
    const models = await discoverGroqModels();
    console.log("Groq key reaches " + models.length + " usable model(s).\n");
    for (const model of models) candidates.push({ provider: "groq", model });
  } catch (error) {
    console.log("Could not list Groq models: " + (error instanceof Error ? error.message : error));
  }
}

if (anthropicKey) {
  for (const model of ["claude-haiku-4-5-20251001", "claude-sonnet-5"]) {
    candidates.push({ provider: "anthropic", model });
  }
}

if (candidates.length === 0) {
  console.log("No candidate models to grade.");
  process.exit(0);
}

console.log(
  "Grading against the real live-call transcript (" +
    turns.length +
    " turns), " +
    RUNS_PER_MODEL +
    " runs each\n",
);

interface Summary {
  provider: string;
  model: string;
  /** Runs that produced a correctly extracted result. */
  clean: number;
  /** Runs that reached the model but got the facts wrong. */
  wrong: number;
  /** Runs that never reached the model. Says nothing about its ability. */
  transport: number;
  bestMs: number;
  misses: string[];
}

const summaries: Summary[] = [];

for (const candidate of candidates) {
  const label = candidate.provider + "/" + candidate.model;
  process.stdout.write("  " + label.padEnd(42) + " ");

  const summary: Summary = {
    provider: candidate.provider,
    model: candidate.model,
    clean: 0,
    wrong: 0,
    transport: 0,
    bestMs: Number.POSITIVE_INFINITY,
    misses: [],
  };
  const marks: string[] = [];

  for (let run = 0; run < RUNS_PER_MODEL; run += 1) {
    const result = await grade(candidate.provider, candidate.model);

    if (!result.ok) {
      summary.transport += 1;
      marks.push(result.transportError ? "rate-limited" : "err");
      // A model that cannot be reached at all is not worth retrying.
      if (!result.transportError) break;
    } else if (result.total > 0 && result.passed === result.total) {
      summary.clean += 1;
      marks.push(String(result.passed));
      if (result.ms !== undefined) summary.bestMs = Math.min(summary.bestMs, result.ms);
    } else {
      summary.wrong += 1;
      marks.push(result.note === "output failed schema validation" ? "schema" : String(result.passed));
      for (const miss of result.failures) {
        if (!summary.misses.includes(miss)) summary.misses.push(miss);
      }
    }

    if (run < RUNS_PER_MODEL - 1) await sleep(SPACING_MS);
  }

  console.log(marks.join("  "));
  if (summary.misses.length > 0) console.log("      missed: " + summary.misses.join("  "));
  summaries.push(summary);
  await sleep(SPACING_MS);
}

console.log("");

/**
 * Rank on reliability, then latency.
 *
 * Every graded run has to be correct: extraction happens once per call, after a
 * call lasting minutes, so a second of latency is worth nothing next to a model
 * that is occasionally wrong. Runs that never reached the provider are excluded
 * rather than counted against the model.
 */
const reliable = summaries
  .filter((s) => s.clean > 0 && s.wrong === 0)
  .sort((a, b) => b.clean - a.clean || a.bestMs - b.bestMs);

if (reliable.length === 0) {
  const best = summaries.filter((s) => s.clean > 0).sort((a, b) => b.clean - a.clean)[0];
  console.log("No model was correct on every run.");
  if (best) {
    console.log(
      "Closest: " + best.provider + "/" + best.model + " (" + best.clean + "/" + RUNS_PER_MODEL + " clean).",
    );
  }
  console.log("Propster falls back to the deterministic parser whenever a model slips.");
} else {
  const best = reliable[0]!;
  console.log("Recommended — add to .env:");
  console.log("");
  if (best.provider === "groq") {
    console.log('  LLM_PROVIDER="groq"');
    console.log('  GROQ_MODEL="' + best.model + '"');
  } else {
    console.log('  LLM_PROVIDER="anthropic"');
    console.log('  ANTHROPIC_MODEL="' + best.model + '"');
  }
  console.log("");
  console.log(
    "Correct on all " + best.clean + " graded runs, fastest " + (best.bestMs / 1000).toFixed(1) + "s.",
  );
  if (reliable.length > 1) {
    console.log(
      "Also perfect: " + reliable.slice(1).map((s) => s.model).join(", "),
    );
  }
  const throttled = summaries.filter((s) => s.transport > 0 && s.clean > 0);
  if (throttled.length > 0) {
    console.log(
      "\nNote: some runs were rate-limited by the provider. Those are excluded from",
    );
    console.log("scoring — they reflect this script's request rate, not model quality.");
  }
}
