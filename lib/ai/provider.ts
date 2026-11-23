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
};

export type AiResponse = {
  text: string;
  toolCalls: AiToolCall[];
  usage: { inputTokens: number; outputTokens: number };
};

export interface AiProvider {
  respond(request: AiRequest): Promise<AiResponse>;
}
