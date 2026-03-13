/**
 * Tool: write_file
 * Writes content to a file, creating parent directories if needed.
 */

import * as fs from 'fs';
import * as path from 'path';

export async function writeFile(
  args: Record<string, unknown>,
  projectPath: string
): Promise<string> {
  const filePath = args.path as string;
  const content = args.content as string;

  const fullPath = path.resolve(projectPath, filePath);

  // Create parent directories
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });

  // Write the file
  fs.writeFileSync(fullPath, content);

  const bytes = Buffer.byteLength(content);
  return `Written ${bytes} bytes to ${filePath}`;
}
