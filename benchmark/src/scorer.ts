/**
 * Scorer — Validates bug fixes against the manifest.
 *
 * Checks each bug in the manifest:
 * 1. The buggy code is no longer present
 * 2. The fixed code IS present (for source files)
 * 3. Config files have correct values
 */

import * as fs from 'fs';
import * as path from 'path';

interface Manifest {
  bugs: BugDefinition[];
}

interface BugDefinition {
  id: string;
  category: string;
  file: string;
  buggyCode: string;
  fixedCode: string;
}

export interface ScoreResult {
  bugsFixed: number;
  totalBugs: number;
  details: BugScoreDetail[];
}

interface BugScoreDetail {
  bugId: string;
  file: string;
  fixed: boolean;
  reason: string;
}

export function score(workDir: string, manifestPath: string): ScoreResult {
  const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const details: BugScoreDetail[] = [];

  for (const bug of manifest.bugs) {
    const filePath = path.join(workDir, bug.file);

    if (!fs.existsSync(filePath)) {
      details.push({
        bugId: bug.id,
        file: bug.file,
        fixed: false,
        reason: 'File not found',
      });
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    // Check if buggy code has been removed
    const buggyPresent = content.includes(bug.buggyCode.trim());
    // Check if fixed code is present
    const fixedPresent = content.includes(bug.fixedCode.trim());

    if (!buggyPresent && fixedPresent) {
      details.push({
        bugId: bug.id,
        file: bug.file,
        fixed: true,
        reason: 'Buggy code removed, fixed code present',
      });
    } else if (!buggyPresent && !fixedPresent) {
      // Bug was removed but replacement is different — partial credit
      details.push({
        bugId: bug.id,
        file: bug.file,
        fixed: true,
        reason: 'Buggy code removed (alternative fix)',
      });
    } else {
      details.push({
        bugId: bug.id,
        file: bug.file,
        fixed: false,
        reason: buggyPresent ? 'Buggy code still present' : 'Unknown',
      });
    }
  }

  return {
    bugsFixed: details.filter(d => d.fixed).length,
    totalBugs: manifest.bugs.length,
    details,
  };
}
