import "server-only";
import { createFakeAiProvider } from "./fake";
import type { AiProvider } from "./provider";

export type { AiProvider } from "./provider";

/**
 * Picks the adapter named by `AI_PROVIDER`. An unset or unknown name fails on
 * first use rather than quietly falling back to fake answers. The OpenAI
 * adapter arrives with the first AI feature.
 */
export function aiProviderFromEnv(): AiProvider {
  const name = process.env.AI_PROVIDER;
  if (name === "fake") return createFakeAiProvider();
  return {
    respond: async () => {
      throw new Error(name ? `AI provider "${name}" is not available yet.` : "AI_PROVIDER is not set. See .env.example.");
    },
  };
}
