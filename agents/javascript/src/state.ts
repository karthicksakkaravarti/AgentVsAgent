/**
 * Block 2: State & Memory Manager (The Context Window)
 *
 * Maintains the growing messages array across the conversation loop.
 * Each iteration serializes this entire array to JSON for the API request.
 *
 * Benchmarks: array manipulation, JSON serialization, memory reallocation.
 */

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

export class StateManager {
  private messages: Message[] = [];

  /** Initialize with system prompt and user message */
  initialize(systemPrompt: string, userMessage: string): void {
    this.messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];
  }

  /** Append the assistant's response (with tool_calls) */
  addAssistantMessage(content: string | null, toolCalls?: ToolCall[]): void {
    const msg: Message = { role: 'assistant', content };
    if (toolCalls && toolCalls.length > 0) {
      msg.tool_calls = toolCalls;
    }
    this.messages.push(msg);
  }

  /** Append a tool result */
  addToolResult(toolCallId: string, result: string): void {
    this.messages.push({
      role: 'tool',
      tool_call_id: toolCallId,
      content: result,
    });
  }

  /** Get all messages for the API request */
  getMessages(): Message[] {
    return this.messages;
  }

  /** Get the total number of messages */
  getMessageCount(): number {
    return this.messages.length;
  }

  /** Estimate the serialized size in bytes */
  getSerializedSize(): number {
    return Buffer.byteLength(JSON.stringify(this.messages));
  }
}
