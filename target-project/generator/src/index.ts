import * as fs from 'fs';
import * as path from 'path';
import { SeededRandom } from './seeded-random';
import { generateFiles } from './file-generator';
import { generateLogs } from './log-generator';
import { generateConfigs } from './config-generator';
import { injectBugs } from './bug-injector';
import { writeManifest } from './manifest-writer';

const SEED = parseInt(process.env.SEED ?? '42', 10);
const OUTPUT_DIR = process.env.OUTPUT_DIR ?? path.join(__dirname, '..', '..', 'generated');
const LOG_SIZE_MB = parseInt(process.env.LOG_SIZE_MB ?? '50', 10);

async function main(): Promise<void> {
  console.log('=== Agent vs Agent: Target Project Generator ===');
  console.log(`  Seed: ${SEED}`);
  console.log(`  Output: ${OUTPUT_DIR}`);
  console.log(`  Log size: ${LOG_SIZE_MB}MB`);
  console.log('');

  const rng = new SeededRandom(SEED);
  const startTime = Date.now();

  // Step 1: Clean output directory
  console.log('[1/5] Cleaning output directory...');
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Step 2: Generate source files
  console.log('[2/5] Generating source files (~10,000 files)...');
  const files = generateFiles(OUTPUT_DIR, rng);
  console.log(`  Generated ${files.length} source files`);

  // Step 3: Generate config files
  console.log('[3/5] Generating config files...');
  const configCount = generateConfigs(OUTPUT_DIR, rng);

  // Step 4: Inject bugs
  console.log('[4/5] Injecting 50 bugs...');
  const bugs = injectBugs(OUTPUT_DIR, files, rng);

  // Step 5: Generate logs (must happen after bug injection to include bug-related log patterns)
  console.log(`[5/5] Generating logs (~${LOG_SIZE_MB}MB)...`);
  generateLogs(OUTPUT_DIR, rng, bugs, LOG_SIZE_MB);

  // Write manifest
  console.log('');
  console.log('Writing manifest...');
  const moduleFiles = files.filter(f => f.category === 'module').length;
  const utilFiles = files.filter(f => f.category === 'utils').length;
  const modelFiles = files.filter(f => f.category === 'models').length;
  const testFiles = files.filter(f => f.category === 'tests').length;

  writeManifest(OUTPUT_DIR, SEED, files.length + configCount, bugs, {
    modules: moduleFiles,
    utils: utilFiles,
    models: modelFiles,
    tests: testFiles,
    configs: configCount,
    logs: 2, // application.log + error.log
  });

  // Write a package.json for the generated project
  fs.writeFileSync(path.join(OUTPUT_DIR, 'package.json'), JSON.stringify({
    name: 'target-project',
    version: '1.0.0',
    description: 'Generated project with intentional bugs for agent benchmarking',
    private: true,
  }, null, 2));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('');
  console.log(`=== Generation complete in ${elapsed}s ===`);
  console.log(`  Total files: ${files.length + configCount + 2}`);
  console.log(`  Total bugs: ${bugs.length}`);
  console.log(`  Output: ${OUTPUT_DIR}`);
}

main().catch(err => {
  console.error('Generation failed:', err);
  process.exit(1);
});
