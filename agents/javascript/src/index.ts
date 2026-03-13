/**
 * Block 5: Orchestration Loop (The Engine / ReAct Loop)
 *
 * The main agent entry point that ties all 5 building blocks together:
 * 1. Load System Prompt (Block 1)
 * 2. Initialize State (Block 2)
 * 3. Send request → Parse response (Block 3)
 * 4. Execute tools via Registry (Block 4)
 * 5. Loop until "stop" (Block 5)
 */

import * as fs from 'fs';
import * as path from 'path';
import { loadSystemPrompt, getUserPrompt } from './prompt';
import { StateManager } from './state';
import { parseResponse } from './parser';
import { executeTool } from './registry';
import { sendChatCompletion } from './api-client';

// Environment configuration
const MOCK_API_URL = process.env.MOCK_API_URL ?? 'http://localhost:8080';
const SESSION_ID = process.env.SESSION_ID ?? `js-agent-${Date.now()}`;
const PROJECT_PATH = process.env.PROJECT_PATH ?? path.join(__dirname, '..', '..', '..', 'target-project', 'generated');

// Load tools schema
const TOOLS_SCHEMA_PATH = path.join(__dirname, '..', '..', 'spec', 'tools-schema.json');
const toolsSchema = JSON.parse(fs.readFileSync(TOOLS_SCHEMA_PATH, 'utf-8'));

// Timing tracker
interface TimingData {
  agent_total_ms: number;
  api_calls: number;
  tool_executions: Record<string, {
    count: number;
    total_ms: number;
    times_ms: number[];
  }>;
}

async function main(): Promise<void> {
  const agentStart = performance.now();

  console.log('=== JavaScript Agent Starting ===');
  console.log(`  API: ${MOCK_API_URL}`);
  console.log(`  Session: ${SESSION_ID}`);
  console.log(`  Project: ${PROJECT_PATH}`);
  console.log('');

  // Block 1: Load system prompt
  const systemPrompt = loadSystemPrompt(PROJECT_PATH);
  const userPrompt = getUserPrompt(PROJECT_PATH);

  // Block 2: Initialize state
  const state = new StateManager();
  state.initialize(systemPrompt, userPrompt);

  // Timing data
  const timing: TimingData = {
    agent_total_ms: 0,
    api_calls: 0,
    tool_executions: {},
  };

  // Block 5: Orchestration loop
  let stepCount = 0;
  const MAX_STEPS = 200; // Safety limit

  while (stepCount < MAX_STEPS) {
    stepCount++;

    // Send state to API (Reason)
    console.log(`[Step ${stepCount}] Sending request to API (${state.getMessageCount()} messages, ~${(state.getSerializedSize() / 1024).toFixed(0)}KB)...`);

    const responseBody = await sendChatCompletion(MOCK_API_URL, SESSION_ID, {
      model: 'gpt-4',
      messages: state.getMessages(),
      tools: toolsSchema.tools,
    });
    timing.api_calls++;

    // Block 3: Parse response (Interpret)
    const result = parseResponse(responseBody);

    if (result.type === 'error') {
      console.error(`[Step ${stepCount}] Parse error: ${result.message}`);
      break;
    }

    if (result.type === 'final_answer') {
      // Agent is done
      console.log(`[Step ${stepCount}] Final answer received.`);
      console.log('');
      console.log('=== Agent Summary ===');
      console.log(result.content.substring(0, 500));
      break;
    }

    // Block 4: Execute tools (Act)
    if (result.type === 'tool_calls') {
      // Add assistant message to state
      state.addAssistantMessage(result.content, result.toolCalls);

      for (const toolCall of result.toolCalls) {
        console.log(`  [Tool] ${toolCall.function.name}(${toolCall.function.arguments.substring(0, 80)}...)`);

        const execResult = await executeTool(
          toolCall.id,
          toolCall.function.name,
          toolCall.function.arguments,
          PROJECT_PATH
        );

        // Record timing
        if (!timing.tool_executions[execResult.toolName]) {
          timing.tool_executions[execResult.toolName] = { count: 0, total_ms: 0, times_ms: [] };
        }
        const toolTiming = timing.tool_executions[execResult.toolName];
        toolTiming.count++;
        toolTiming.total_ms += execResult.executionTimeMs;
        toolTiming.times_ms.push(Math.round(execResult.executionTimeMs * 100) / 100);

        console.log(`  [Tool] ${execResult.toolName} completed in ${execResult.executionTimeMs.toFixed(1)}ms (${execResult.result.length} chars)`);

        // Add tool result to state (Observe)
        state.addToolResult(toolCall.id, execResult.result);
      }
    }
  }

  if (stepCount >= MAX_STEPS) {
    console.error(`Agent hit maximum step limit (${MAX_STEPS})`);
  }

  // Output timing data (last line of stdout — consumed by benchmark runner)
  timing.agent_total_ms = Math.round((performance.now() - agentStart) * 100) / 100;

  console.log('');
  console.log(`=== Agent completed in ${(timing.agent_total_ms / 1000).toFixed(2)}s (${timing.api_calls} API calls) ===`);
  console.log(JSON.stringify(timing));
}

main().catch(err => {
  console.error('Agent failed:', err);
  process.exit(1);
});
