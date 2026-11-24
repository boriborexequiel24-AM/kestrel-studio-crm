import "server-only";
import { createFakeAiProvider } from "./fake";
import { DEFAULT_OPENAI_MODEL, createOpenAiProvider } from "./openai";
import type { AiProvider } from "./provider";

export type { AiProvider } from "./provider";

/**
 * Picks the adapter named by `AI_PROVIDER`. An unset or unknown name, or a
 * missing key, fails on first use rather than quietly falling back to fake
 * answers.
 */
export function aiProviderFromEnv(): AiProvider {
  const name = process.env.AI_PROVIDER;
  if (name === "fake") return createFakeAiProvider();
  if (name !== "openai") return unusable(name ? `AI provider "${name}" is not known.` : "AI_PROVIDER is not set. See .env.example.");
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return unusable("OPENAI_API_KEY is not set. See .env.example.");
  // A stray line break would make fetch throw an error that quotes the key.
  if (/\s/.test(apiKey)) return unusable("OPENAI_API_KEY has a space or line break in it.");
  return createOpenAiProvider({ apiKey, model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL });
}

function unusable(reason: string): AiProvider {
  return {
    respond: async () => {
      throw new Error(reason);
    },
  };
}
