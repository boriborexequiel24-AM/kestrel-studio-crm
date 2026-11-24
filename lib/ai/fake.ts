import type { AiProvider, AiRequest, AiResponse } from "./provider";

export type FakeAiProvider = AiProvider & {
  /** Every request the provider received, oldest first. */
  requests: AiRequest[];
  /** Queue the next responses, e.g. a scripted tool call followed by a final answer. */
  script(...responses: Partial<AiResponse>[]): void;
};

const FAKE_ANSWER = "- Fake AI response, line one.\n- Fake AI response, line two.\n- Fake AI response, line three.";

/**
 * A provider for tests and offline development. It never calls a network.
 * Without a script it answers with three fixed lines.
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
        text: next.text ?? FAKE_ANSWER,
        toolCalls: next.toolCalls ?? [],
        complete: next.complete ?? true,
        usage: next.usage ?? { inputTokens: 100, outputTokens: 20, costUsd: 0 },
      };
    },
  };
}
