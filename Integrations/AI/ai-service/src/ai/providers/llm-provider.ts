export type LlmRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmGenerateOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface LlmToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface LlmGenerateResponse {
  text: string;
  toolCall?: LlmToolCall;
}

export interface LlmProvider {
  readonly providerName: string;
  isConfigured(): boolean;
  ensureAvailable(): Promise<boolean>;
  generate(
    messages: LlmMessage[],
    tools: LlmToolDefinition[],
    options?: LlmGenerateOptions,
  ): Promise<LlmGenerateResponse>;
}
