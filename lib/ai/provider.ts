// The AI module only talks to a model provider. Prompts, limits and usage
// logging belong to the CRM module (see the v1 spec, "Modules").

export type AiTool = {
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments. */
  parameters: Record<string, unknown>;
};

export type AiToolCall = { id: string; name: string; arguments: unknown };

export type AiInputItem =
  | { type: "message"; role: "user" | "assistant"; content: string }
  | { type: "tool_call"; call: AiToolCall }
  | { type: "tool_result"; callId: string; output: unknown };

export type AiRequest = {
  instructions: string;
  input: AiInputItem[];
  tools?: AiTool[];
  /** Holds what one answer can cost. Counts any thinking the model does first. */
  maxOutputTokens: number;
};

/** What a request used. The cost is null when the model's price isn't known. */
export type AiUsage = { inputTokens: number; outputTokens: number; costUsd: number | null };

export type AiResponse = {
  text: string;
  toolCalls: AiToolCall[];
  /** False when the answer was cut off, such as by `maxOutputTokens`. */
  complete: boolean;
  usage: AiUsage;
};

export interface AiProvider {
  respond(request: AiRequest): Promise<AiResponse>;
}
