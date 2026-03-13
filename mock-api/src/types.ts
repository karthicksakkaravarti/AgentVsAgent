// OpenAI-compatible API types

export interface ChatCompletionRequest {
  model: string;
  messages: Message[];
  tools?: ToolDefinition[];
  temperature?: number;
  max_tokens?: number;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Choice[];
  usage: Usage;
}

export interface Choice {
  index: number;
  message: Message;
  finish_reason: 'stop' | 'tool_calls';
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// Golden transcript types

export interface GoldenTranscript {
  version: string;
  description: string;
  targetProject: {
    seed: number;
    totalBugs: number;
  };
  systemPrompt: string;
  userPrompt: string;
  steps: TranscriptStep[];
}

export interface TranscriptStep {
  stepNumber: number;
  description?: string;
  response: ChatCompletionResponse;
  expectedToolResults?: Array<{
    toolCallId: string;
    contentPattern?: string;
  }>;
}

// Session types

export interface SessionState {
  sessionId: string;
  currentStep: number;
  totalSteps: number;
  startedAt: number;
  completedAt?: number;
  requestLog: RequestLogEntry[];
}

export interface RequestLogEntry {
  step: number;
  requestReceivedAt: number;
  responseSentAt: number;
  configuredDelayMs: number;
}

// Session metrics (returned by GET /v1/sessions/:id/metrics)

export interface SessionMetrics {
  sessionId: string;
  totalSteps: number;
  stepsCompleted: number;
  startedAt: number;
  completedAt?: number;
  totalApiWaitMs: number;
  requestLog: RequestLogEntry[];
}
