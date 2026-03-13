/**
 * Tool: read_file
 * Reads file contents with optional line range support.
 * For large files (50MB+), uses streaming for range reads.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

export async function readFile(
  args: Record<string, unknown>,
  projectPath: string
): Promise<string> {
  const filePath = args.path as string;
  const startLine = args.startLine as number | undefined;
  const endLine = args.endLine as number | undefined;

  const fullPath = path.resolve(projectPath, filePath);

  if (!fs.existsSync(fullPath)) {
    return `Error: File not found: ${filePath}`;
  }

  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    return `Error: ${filePath} is a directory, not a file`;
  }

  // For range reads on large files, use line-by-line reading
  if ((startLine || endLine) && stat.size > 1024 * 1024) {
    return readFileRange(fullPath, startLine, endLine);
  }

  // Read entire file
  const content = fs.readFileSync(fullPath, 'utf-8');

  if (startLine || endLine) {
    const lines = content.split('\n');
    const start = (startLine ?? 1) - 1;
    const end = endLine ?? lines.length;
    const slice = lines.slice(start, end);
    return slice.map((line, i) => `${start + i + 1}: ${line}`).join('\n');
  }

  // Add line numbers
  const lines = content.split('\n');
  return lines.map((line, i) => `${i + 1}: ${line}`).join('\n');
}

async function readFileRange(
  fullPath: string,
  startLine: number | undefined,
  endLine: number | undefined
): Promise<string> {
  const start = startLine ?? 1;
  const end = endLine ?? Infinity;
  const result: string[] = [];
  let lineNumber = 0;

  const fileStream = fs.createReadStream(fullPath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    lineNumber++;
    if (lineNumber >= start && lineNumber <= end) {
      result.push(`${lineNumber}: ${line}`);
    }
    if (lineNumber > end) {
      rl.close();
      break;
    }
  }

  return result.join('\n');
}
