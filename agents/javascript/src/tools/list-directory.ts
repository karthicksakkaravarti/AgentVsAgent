/**
 * Tool: list_directory
 * Lists directory contents with type and size information.
 * Supports recursive listing with depth control.
 */

import * as fs from 'fs';
import * as path from 'path';

export async function listDirectory(
  args: Record<string, unknown>,
  projectPath: string
): Promise<string> {
  const dirPath = args.path as string ?? '.';
  const recursive = args.recursive as boolean ?? false;
  const maxDepth = args.maxDepth as number ?? 3;

  const fullPath = path.resolve(projectPath, dirPath);

  if (!fs.existsSync(fullPath)) {
    return `Error: Directory not found: ${dirPath}`;
  }

  const stat = fs.statSync(fullPath);
  if (!stat.isDirectory()) {
    return `Error: ${dirPath} is not a directory`;
  }

  const entries: string[] = [];
  listDir(fullPath, projectPath, entries, recursive, maxDepth, 0);

  if (entries.length === 0) {
    return `Directory ${dirPath} is empty`;
  }

  return entries.join('\n');
}

function listDir(
  dir: string,
  projectRoot: string,
  entries: string[],
  recursive: boolean,
  maxDepth: number,
  currentDepth: number
): void {
  let dirEntries: fs.Dirent[];
  try {
    dirEntries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  const indent = '  '.repeat(currentDepth);

  for (const entry of dirEntries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Count children for display
      let childCount = 0;
      try {
        childCount = fs.readdirSync(fullPath).length;
      } catch {
        // ignore
      }
      entries.push(`${indent}[DIR]  ${entry.name}/ (${childCount} items)`);

      if (recursive && currentDepth < maxDepth) {
        listDir(fullPath, projectRoot, entries, recursive, maxDepth, currentDepth + 1);
      }
    } else if (entry.isFile()) {
      try {
        const stat = fs.statSync(fullPath);
        const size = formatSize(stat.size);
        entries.push(`${indent}[FILE] ${entry.name} (${size})`);
      } catch {
        entries.push(`${indent}[FILE] ${entry.name}`);
      }
    }
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
