/**
 * Block 3: Parser / Output Extractor (The Interpreter)
 *
 * Parses API responses and determines whether the LLM is requesting
 * tool execution or providing a final answer.
 *
 * Benchmarks: JSON deserialization, deeply nested object traversal.
 */

import { ToolCall } from './state';

export interface ApiResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: 'stop' | 'tool_calls';
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export type ParseResult =
  | { type: 'tool_calls'; toolCalls: ToolCall[]; content: string | null }
  | { type: 'final_answer'; content: string }
  | { type: 'error'; message: string };

/**
 * Parse the raw API response body into a structured result.
 */
export function parseResponse(responseBody: string): ParseResult {
  let parsed: ApiResponse;
  try {
    parsed = JSON.parse(responseBody);
  } catch (e) {
    return { type: 'error', message: `Failed to parse JSON: ${e}` };
  }

  if (!parsed.choices || parsed.choices.length === 0) {
    return { type: 'error', message: 'Response has no choices' };
  }

  const choice = parsed.choices[0];

  if (choice.finish_reason === 'stop') {
    return {
      type: 'final_answer',
      content: choice.message.content ?? '',
    };
  }

  if (choice.finish_reason === 'tool_calls') {
    const toolCalls = choice.message.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      return { type: 'error', message: 'finish_reason is tool_calls but no tool_calls found' };
    }
    return {
      type: 'tool_calls',
      toolCalls,
      content: choice.message.content,
    };
  }

  return { type: 'error', message: `Unknown finish_reason: ${choice.finish_reason}` };
}

/**
 * Parse tool call arguments from JSON string.
 */
export function parseToolArguments(argsJson: string): Record<string, unknown> {
  return JSON.parse(argsJson);
}
