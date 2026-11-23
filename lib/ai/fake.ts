import type { AiProvider, AiRequest, AiResponse } from "./provider";

export type FakeAiProvider = AiProvider & {
  /** Every request the provider received, oldest first. */
  requests: AiRequest[];
  /** Queue the next responses, e.g. a scripted tool call followed by a final answer. */
  script(...responses: Partial<AiResponse>[]): void;
};

/**
 * A provider for tests and offline development. It never calls a network.
 * Without a script it answers with a fixed line.
 */
export function createFakeAiProvider(): FakeAiProvider {
  const queue: Partial<AiResponse>[] = [];
  const requests: AiRequest[] = [];
  return {
    requests,
    script(...responses) {
      queue.push(...responses);
    },
    async respond(request) {
      requests.push(request);
      const next = queue.shift() ?? {};
      return {
        text: next.text ?? "Fake AI response.",
        toolCalls: next.toolCalls ?? [],
        usage: next.usage ?? { inputTokens: 100, outputTokens: 20 },
      };
    },
  };
}
