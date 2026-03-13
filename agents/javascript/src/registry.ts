/**
 * Block 4: Tool Registry (The Hands)
 *
 * Maps tool names to their handler functions.
 * Routes parsed tool_calls to the actual local implementations.
 *
 * Benchmarks: heavy disk I/O, regex matching, directory traversal.
 */

import { searchFiles } from './tools/search-files';
import { readFile } from './tools/read-file';
import { writeFile } from './tools/write-file';
import { listDirectory } from './tools/list-directory';
import { executeCommand } from './tools/execute-command';
import { analyzeCode } from './tools/analyze-code';
import { parseToolArguments } from './parser';

export type ToolHandler = (args: Record<string, unknown>, projectPath: string) => Promise<string>;

const toolRegistry: Map<string, ToolHandler> = new Map([
  ['search_files', searchFiles],
  ['read_file', readFile],
  ['write_file', writeFile],
  ['list_directory', listDirectory],
  ['execute_command', executeCommand],
  ['analyze_code', analyzeCode],
]);

export interface ToolExecutionResult {
  toolCallId: string;
  toolName: string;
  result: string;
  executionTimeMs: number;
}

/**
 * Execute a tool call by looking up the handler in the registry.
 */
export async function executeTool(
  toolCallId: string,
  toolName: string,
  argsJson: string,
  projectPath: string
): Promise<ToolExecutionResult> {
  const handler = toolRegistry.get(toolName);
  if (!handler) {
    return {
      toolCallId,
      toolName,
      result: `Error: Unknown tool "${toolName}". Available tools: ${Array.from(toolRegistry.keys()).join(', ')}`,
      executionTimeMs: 0,
    };
  }

  const args = parseToolArguments(argsJson);
  const startTime = performance.now();

  try {
    const result = await handler(args, projectPath);
    const executionTimeMs = performance.now() - startTime;
    return { toolCallId, toolName, result, executionTimeMs };
  } catch (err: any) {
    const executionTimeMs = performance.now() - startTime;
    return {
      toolCallId,
      toolName,
      result: `Error executing ${toolName}: ${err.message}`,
      executionTimeMs,
    };
  }
}

/**
 * Get the list of available tool names.
 */
export function getToolNames(): string[] {
  return Array.from(toolRegistry.keys());
}
