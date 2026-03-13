/**
 * Tool: search_files
 * Searches file contents using regex patterns.
 * Uses native Node.js filesystem APIs — no shelling out.
 */

import * as fs from 'fs';
import * as path from 'path';

export async function searchFiles(
  args: Record<string, unknown>,
  projectPath: string
): Promise<string> {
  const pattern = args.pattern as string;
  const searchPath = args.path as string | undefined ?? '.';
  const include = args.include as string | undefined;
  const maxResults = (args.maxResults as number | undefined) ?? 100;

  const regex = new RegExp(pattern);
  const fullPath = path.resolve(projectPath, searchPath);
  const matches: string[] = [];

  // Get glob filter regex if provided
  const includeRegex = include ? globToRegex(include) : null;

  walkAndSearch(fullPath, regex, includeRegex, projectPath, matches, maxResults);

  if (matches.length === 0) {
    return `No matches found for pattern "${pattern}" in ${searchPath}`;
  }

  return matches.join('\n');
}

function walkAndSearch(
  dir: string,
  regex: RegExp,
  includeRegex: RegExp | null,
  projectRoot: string,
  matches: string[],
  maxResults: number
): void {
  if (matches.length >= maxResults) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (matches.length >= maxResults) return;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules, .git, etc.
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walkAndSearch(fullPath, regex, includeRegex, projectRoot, matches, maxResults);
    } else if (entry.isFile()) {
      // Check include filter
      if (includeRegex && !includeRegex.test(entry.name)) continue;

      // Read and search file
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        const relativePath = path.relative(projectRoot, fullPath);

        for (let i = 0; i < lines.length; i++) {
          if (matches.length >= maxResults) return;
          if (regex.test(lines[i])) {
            matches.push(`${relativePath}:${i + 1}: ${lines[i].trim()}`);
          }
        }
      } catch {
        // Skip binary files or files we can't read
      }
    }
  }
}

function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}
