/**
 * Block 1: System Prompt & Persona (The Rules)
 *
 * Loads the shared system prompt and prepares it with the project path.
 * This is identical across all language implementations.
 */

import * as fs from 'fs';
import * as path from 'path';

const PROMPT_FILE = path.join(__dirname, '..', '..', 'spec', 'system-prompt.txt');

export function loadSystemPrompt(projectPath: string): string {
  const template = fs.readFileSync(PROMPT_FILE, 'utf-8');
  return template.replace(/\{PROJECT_PATH\}/g, projectPath);
}

export function getUserPrompt(projectPath: string): string {
  return `The project at ${projectPath} has several bugs causing production errors. Find and fix all of them. Start by examining the error logs in the logs/ directory.`;
}
