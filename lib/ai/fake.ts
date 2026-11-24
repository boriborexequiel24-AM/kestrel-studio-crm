import type { AiProvider, AiRequest, AiResponse } from "./provider";

export type FakeAiProvider = AiProvider & {
  /** Every request the provider received, oldest first. */
  requests: AiRequest[];
  /** Queue the next responses, e.g. a scripted tool call followed by a final answer. */
  script(...responses: Partial<AiResponse>[]): void;
};

const FAKE_ANSWER = "- Fake AI response, line one.\n- Fake AI response, line two.\n- Fake AI response, line three.";

/** With tools on offer and nothing scripted, it uses the first one once, so a chat shows lookups and links locally. */
function unscripted({ tools, input, mustAnswer }: AiRequest): Partial<AiResponse> {
  if (!tools) return {};
  if (mustAnswer || input.at(-1)?.type === "tool_result") return { text: "Fake AI answer. The first Deal found is [[D1]], at [[C1]]." };
  return { text: "", toolCalls: [{ id: "fake-call", name: tools[0].name, arguments: {} }] };
}

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
      const next = queue.shift() ?? unscripted(request);
      return {
        text: next.text ?? FAKE_ANSWER,
        toolCalls: next.toolCalls ?? [],
        complete: next.complete ?? true,
        usage: next.usage ?? { inputTokens: 100, outputTokens: 20, costUsd: 0 },
      };
    },
  };
}
