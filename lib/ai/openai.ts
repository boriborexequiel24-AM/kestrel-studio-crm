import "server-only";
import type { AiInputItem, AiProvider, AiRequest, AiResponse, AiUsage } from "./provider";

const ENDPOINT = "https://api.openai.com/v1/responses";
const TIMEOUT_MS = 30_000;
export const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";

/** US dollars per million tokens, from OpenAI's model pages (checked 2026-11-24). */
const PRICES: Record<string, { input: number; cachedInput: number; output: number }> = {
  "gpt-5.4-mini": { input: 0.75, cachedInput: 0.075, output: 4.5 },
};

type ResponsesUsage = { input_tokens: number; output_tokens: number; input_tokens_details?: { cached_tokens?: number } };
type ResponsesItem =
  | { type: "message"; content: { type: string; text?: string }[] }
  | { type: "function_call"; call_id: string; name: string; arguments: string }
  | { type: "reasoning" };
type ResponsesBody = { status?: string; output: ResponsesItem[]; usage?: ResponsesUsage };

/** OpenAI over plain HTTP, through the Responses API. Nothing is stored on their side. */
export function createOpenAiProvider({ apiKey, model }: { apiKey: string; model: string }): AiProvider {
  return {
    async respond(request) {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(toBody(request, model)),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`OpenAI answered ${response.status}.`);
      return toResponse((await response.json()) as ResponsesBody, model);
    },
  };
}

function toBody({ instructions, input, tools, maxOutputTokens }: AiRequest, model: string) {
  return {
    model,
    instructions,
    input: input.map(toItem),
    tools: tools?.map((tool) => ({ type: "function", ...tool })),
    max_output_tokens: maxOutputTokens,
    reasoning: { effort: "low" },
    store: false,
  };
}

function toItem(item: AiInputItem) {
  if (item.type === "message") return { role: item.role, content: item.content };
  if (item.type === "tool_result") return { type: "function_call_output", call_id: item.callId, output: JSON.stringify(item.output) };
  const { id, name, arguments: args } = item.call;
  return { type: "function_call", call_id: id, name, arguments: JSON.stringify(args) };
}

function toResponse({ status, output, usage }: ResponsesBody, model: string): AiResponse {
  return {
    text: output.flatMap((item) => (item.type === "message" ? item.content.map((part) => part.text ?? "") : [])).join(""),
    toolCalls: output.flatMap((item) =>
      item.type === "function_call" ? [{ id: item.call_id, name: item.name, arguments: parseArguments(item.arguments) }] : [],
    ),
    complete: status === "completed",
    usage: toUsage(usage, model),
  };
}

/** The model writes these, so they may not be JSON; the caller then sees null. */
function parseArguments(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toUsage(usage: ResponsesUsage | undefined, model: string): AiUsage {
  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;
  const cached = usage?.input_tokens_details?.cached_tokens ?? 0;
  // A dated name, such as gpt-5.4-mini-2026-03-17, costs the same as the plain one.
  const price = PRICES[model.replace(/-\d{4}-\d{2}-\d{2}$/, "")];
  const costUsd = price
    ? ((inputTokens - cached) * price.input + cached * price.cachedInput + outputTokens * price.output) / 1_000_000
    : null;
  return { inputTokens, outputTokens, costUsd };
}
