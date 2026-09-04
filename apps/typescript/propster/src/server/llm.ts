import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";
import { logger } from "./logger";

/**
 * One small seam over whichever language model is configured.
 *
 * Propster uses an LLM in exactly two places — turning a sentence into a search
 * requirement, and turning a noisy call transcript into structured facts — and
 * both want the same thing: a JSON object matching a schema. Neither cares who
 * produces it. Routing both through here means the vendor is a configuration
 * decision rather than something welded into the extraction logic.
 *
 * Groq is used when a Groq key is present, Anthropic otherwise. Every caller
 * still validates the result against a Zod schema, so a weaker model produces a
 * failed extraction rather than bad data.
 */

export type LlmProvider = "groq" | "anthropic" | "none";

/** Which provider will actually serve a request, given current configuration. */
export function activeProvider(): LlmProvider {
  const forced = env.llm.provider;
  if (forced === "groq") return env.groq.apiKey ? "groq" : "none";
  if (forced === "anthropic") return env.anthropic.apiKey ? "anthropic" : "none";
  // Auto: prefer whichever key exists, Groq first.
  if (env.groq.apiKey) return "groq";
  if (env.anthropic.apiKey) return "anthropic";
  return "none";
}

export function usingLlm(): boolean {
  return activeProvider() !== "none";
}

/** The model that will be used, for logging and for the UI's provenance line. */
export function activeModel(): string | null {
  switch (activeProvider()) {
    case "groq":
      return env.groq.model;
    case "anthropic":
      return env.anthropic.model;
    default:
      return null;
  }
}

export interface JsonCompletionRequest {
  system: string;
  user: string;
  maxTokens?: number;
  /** Overrides the configured model, used by the grading script. */
  model?: string;
  /** Overrides the configured provider, used by the grading script. */
  provider?: LlmProvider;
}

/**
 * Ask the model for a single JSON object.
 *
 * Returns the raw text. Parsing and schema validation are the caller's job,
 * deliberately: this layer must not decide what counts as a valid answer.
 */
export async function completeJson(request: JsonCompletionRequest): Promise<string | null> {
  const provider = request.provider ?? activeProvider();

  try {
    if (provider === "groq") return await completeWithGroq(request);
    if (provider === "anthropic") return await completeWithAnthropic(request);
    return null;
  } catch (error) {
    logger.warn("llm.request_failed", {
      provider,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Groq exposes an OpenAI-compatible chat completions endpoint, so this is a
 * plain fetch rather than another SDK dependency.
 *
 * `response_format: json_object` makes the model emit a bare JSON object
 * instead of prose wrapped in a code fence, which removes a whole class of
 * parse failures.
 */
async function completeWithGroq(request: JsonCompletionRequest): Promise<string | null> {
  const model = request.model ?? env.groq.model;

  const response = await fetch(env.groq.baseUrl + "/chat/completions", {
    method: "POST",
    headers: {
      authorization: "Bearer " + env.groq.apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: request.maxTokens ?? 1500,
      // Extraction should be reproducible: the same transcript must not produce
      // a different rent on a second run.
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error("Groq " + response.status + ": " + detail.slice(0, 200));
  }

  const payload: unknown = await response.json();
  const choice =
    payload && typeof payload === "object"
      ? (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]
      : undefined;
  const content = choice?.message?.content;
  return typeof content === "string" ? content : null;
}

async function completeWithAnthropic(request: JsonCompletionRequest): Promise<string | null> {
  const client = new Anthropic({ apiKey: env.anthropic.apiKey });
  const response = await client.messages.create({
    model: request.model ?? env.anthropic.model,
    max_tokens: request.maxTokens ?? 1500,
    temperature: 0,
    system: request.system,
    messages: [{ role: "user", content: request.user }],
  });

  const block = response.content.find((item) => item.type === "text");
  return block && block.type === "text" ? block.text : null;
}

/**
 * Pull the first JSON object out of a model response.
 *
 * Tolerates code fences and leading prose, because not every model honours a
 * "JSON only" instruction even when asked politely.
 */
export function parseJsonObject(text: string | null): unknown {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}
