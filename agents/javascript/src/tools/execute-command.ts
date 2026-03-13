/**
 * Tool: execute_command
 * Executes a shell command in the project directory.
 * Enforces timeout and captures stdout/stderr.
 */

import { execSync } from 'child_process';

export async function executeCommand(
  args: Record<string, unknown>,
  projectPath: string
): Promise<string> {
  const command = args.command as string;
  const timeout = (args.timeout as number | undefined) ?? 30000;

  try {
    const output = execSync(command, {
      cwd: projectPath,
      timeout,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return `Exit code: 0\nStdout:\n${output}`;
  } catch (err: any) {
    const exitCode = err.status ?? 1;
    const stdout = err.stdout ?? '';
    const stderr = err.stderr ?? '';

    return `Exit code: ${exitCode}\nStdout:\n${stdout}\nStderr:\n${stderr}`;
  }
}
