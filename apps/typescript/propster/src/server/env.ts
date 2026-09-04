import "server-only";

import { z } from "zod";

/**
 * Server-side configuration.
 *
 * Importing "server-only" makes this module a build error if it is ever pulled
 * into a client component, which is the guarantee that no key here can reach
 * the browser bundle. Nothing in Propster is prefixed NEXT_PUBLIC_.
 */

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default("file:./dev.db"),
  CALLE_API_KEY: z.string().default(""),
  CALLE_BASE_URL: z.string().default("https://api.heycall-e.com"),
  CALLE_WEBHOOK_TOKEN: z.string().default(""),
  CALLE_PHONE_ALLOWLIST: z.string().default(""),
  PUBLIC_APP_URL: z.string().default(""),
  ANTHROPIC_API_KEY: z.string().default(""),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),
  GROQ_API_KEY: z.string().default(""),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  GROQ_BASE_URL: z.string().default("https://api.groq.com/openai/v1"),
  // "groq" | "anthropic" | "auto". Auto prefers whichever key is present.
  LLM_PROVIDER: z.string().default("auto"),
  PROPSTER_DEMO_MODE: z.string().default("false"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error("Invalid server environment: " + parsed.error.message);
}

const raw = parsed.data;

const toBool = (value: string) => value.trim().toLowerCase() === "true";

export const env = {
  databaseUrl: raw.DATABASE_URL,

  calle: {
    apiKey: raw.CALLE_API_KEY.trim(),
    baseUrl: raw.CALLE_BASE_URL.trim() || "https://api.heycall-e.com",
    webhookToken: raw.CALLE_WEBHOOK_TOKEN.trim(),
    allowlist: raw.CALLE_PHONE_ALLOWLIST.split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  },

  anthropic: {
    apiKey: raw.ANTHROPIC_API_KEY.trim(),
    model: raw.ANTHROPIC_MODEL.trim() || "claude-sonnet-5",
  },

  groq: {
    apiKey: raw.GROQ_API_KEY.trim(),
    model: raw.GROQ_MODEL.trim() || "llama-3.3-70b-versatile",
    baseUrl: (raw.GROQ_BASE_URL.trim() || "https://api.groq.com/openai/v1").replace(/\/+$/, ""),
  },

  llm: {
    provider: (["groq", "anthropic", "auto"].includes(raw.LLM_PROVIDER.trim().toLowerCase())
      ? raw.LLM_PROVIDER.trim().toLowerCase()
      : "auto") as "groq" | "anthropic" | "auto",
  },

  publicAppUrl: raw.PUBLIC_APP_URL.trim().replace(/\/+$/, ""),
  demoMode: toBool(raw.PROPSTER_DEMO_MODE),
} as const;

/** True when Propster will place real outbound calls through CALL-E. */
export function usingRealCalle(): boolean {
  return !env.demoMode && env.calle.apiKey.length > 0;
}

/**
 * True when a language model is configured for extraction, from any provider.
 * `src/server/llm.ts` decides which one actually serves the request.
 */
export function usingClaude(): boolean {
  if (env.llm.provider === "groq") return env.groq.apiKey.length > 0;
  if (env.llm.provider === "anthropic") return env.anthropic.apiKey.length > 0;
  return env.groq.apiKey.length > 0 || env.anthropic.apiKey.length > 0;
}

/**
 * Webhook callback URL handed to CALL-E, or undefined when this instance is
 * not publicly reachable. Without it the service falls back to polling.
 */
export function calleWebhookUrl(): string | undefined {
  if (!env.publicAppUrl || !env.calle.webhookToken) return undefined;
  if (!env.publicAppUrl.startsWith("https://")) return undefined;
  return env.publicAppUrl + "/api/call-e/webhook/" + env.calle.webhookToken;
}
