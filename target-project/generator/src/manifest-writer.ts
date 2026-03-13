import * as fs from 'fs';
import * as path from 'path';
import { BugDefinition } from './bug-injector';

export interface Manifest {
  version: string;
  generatedAt: string;
  seed: number;
  totalFiles: number;
  totalBugs: number;
  bugs: BugDefinition[];
  fileStats: {
    modules: number;
    utils: number;
    models: number;
    tests: number;
    configs: number;
    logs: number;
  };
}

export function writeManifest(
  outputDir: string,
  seed: number,
  totalFiles: number,
  bugs: BugDefinition[],
  fileStats: Manifest['fileStats']
): void {
  const manifest: Manifest = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    seed,
    totalFiles,
    totalBugs: bugs.length,
    bugs,
    fileStats,
  };

  const manifestPath = path.join(outputDir, '..', 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`  Manifest written: ${manifestPath}`);
  console.log(`  Total bugs: ${bugs.length}`);
  bugs.forEach(bug => {
    console.log(`    [${bug.id}] ${bug.category} in ${bug.file}: ${bug.description.slice(0, 60)}...`);
  });
}
