/**
 * Benchmark Runner — Main Orchestrator
 *
 * Spawns each agent against the mock API, collects metrics,
 * validates correctness, and produces comparison results.
 */

import { execSync, spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { score } from './scorer';
import { generateReport, BenchmarkResult, BenchmarkRun } from './report-generator';

interface BenchmarkConfig {
  mockApiPort: number;
  responseDelayMs: number;
  projectPath: string;
  manifestPath: string;
  transcriptPath: string;
  languages: LanguageConfig[];
}

interface LanguageConfig {
  name: string;
  buildCommand?: string;
  runCommand: string;
  cwd: string;
}

const ROOT = path.resolve(__dirname, '..', '..');

const DEFAULT_CONFIG: BenchmarkConfig = {
  mockApiPort: 8080,
  responseDelayMs: 500,
  projectPath: path.join(ROOT, 'target-project', 'generated'),
  manifestPath: path.join(ROOT, 'target-project', 'manifest.json'),
  transcriptPath: path.join(ROOT, 'golden-transcript', 'transcript.json'),
  languages: [
    {
      name: 'javascript',
      buildCommand: 'npm run build',
      runCommand: 'node dist/index.js',
      cwd: path.join(ROOT, 'agents', 'javascript'),
    },
    {
      name: 'python',
      runCommand: 'python3 src/main.py',
      cwd: path.join(ROOT, 'agents', 'python'),
    },
    {
      name: 'go',
      buildCommand: 'go build -o bin/agent ./cmd/agent',
      runCommand: './bin/agent',
      cwd: path.join(ROOT, 'agents', 'go'),
    },
    {
      name: 'rust',
      buildCommand: 'cargo build --release',
      runCommand: './target/release/agent-rust',
      cwd: path.join(ROOT, 'agents', 'rust'),
    },
  ],
};

async function main(): Promise<void> {
  const config = DEFAULT_CONFIG;
  const selectedLanguages = process.argv.slice(2);

  console.log('=== Agent vs Agent Benchmark Runner ===');
  console.log(`  Mock API Port: ${config.mockApiPort}`);
  console.log(`  Response Delay: ${config.responseDelayMs}ms`);
  console.log(`  Project: ${config.projectPath}`);
  console.log('');

  // Validate prerequisites
  if (!fs.existsSync(config.projectPath)) {
    console.error('Target project not found. Run `npm run generate` first.');
    process.exit(1);
  }
  if (!fs.existsSync(config.transcriptPath)) {
    console.error('Golden transcript not found.');
    process.exit(1);
  }

  const languages = selectedLanguages.length > 0
    ? config.languages.filter(l => selectedLanguages.includes(l.name))
    : config.languages;

  if (languages.length === 0) {
    console.error('No languages selected. Available:', config.languages.map(l => l.name).join(', '));
    process.exit(1);
  }

  // Build agents first (not timed)
  console.log('[BUILD] Building agents...');
  for (const lang of languages) {
    if (lang.buildCommand) {
      console.log(`  Building ${lang.name}...`);
      try {
        execSync(lang.buildCommand, { cwd: lang.cwd, stdio: 'pipe' });
        console.log(`  ✓ ${lang.name} built successfully`);
      } catch (err: any) {
        console.error(`  ✗ ${lang.name} build failed: ${err.stderr?.toString()}`);
        continue;
      }
    }
  }
  console.log('');

  // Start mock API server
  console.log('[MOCK API] Starting mock API server...');
  const mockApiProcess = startMockApi(config);
  await sleep(2000); // Wait for server to start
  console.log('');

  // Run each agent
  const results: BenchmarkResult[] = [];

  for (const lang of languages) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[BENCHMARK] Running ${lang.name} agent...`);
    console.log(`${'='.repeat(60)}\n`);

    // Copy target project to temp dir for isolation
    const workDir = path.join(ROOT, 'benchmark', 'work', lang.name);
    if (fs.existsSync(workDir)) {
      fs.rmSync(workDir, { recursive: true });
    }
    fs.cpSync(config.projectPath, workDir, { recursive: true });

    const sessionId = `bench-${lang.name}-${Date.now()}`;
    const env = {
      ...process.env,
      MOCK_API_URL: `http://localhost:${config.mockApiPort}`,
      SESSION_ID: sessionId,
      PROJECT_PATH: workDir,
    };

    const startTime = Date.now();

    try {
      const output = execSync(lang.runCommand, {
        cwd: lang.cwd,
        env,
        timeout: 300000, // 5 minute timeout
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024,
      });

      const totalTimeMs = Date.now() - startTime;

      // Parse timing data from last line
      const lines = output.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      let agentTiming: any = {};
      try {
        agentTiming = JSON.parse(lastLine);
      } catch {
        console.warn(`  Warning: Could not parse timing data for ${lang.name}`);
      }

      // Fetch API metrics
      let apiMetrics: any = {};
      try {
        const metricsResp = execSync(
          `curl -s http://localhost:${config.mockApiPort}/v1/sessions/${sessionId}/metrics`,
          { encoding: 'utf-8' }
        );
        apiMetrics = JSON.parse(metricsResp);
      } catch {
        console.warn(`  Warning: Could not fetch API metrics for ${lang.name}`);
      }

      // Score correctness
      const correctness = score(workDir, config.manifestPath);

      const apiWaitTimeMs = apiMetrics.totalApiWaitMs ?? 0;

      const result: BenchmarkResult = {
        language: lang.name,
        timestamp: new Date().toISOString(),
        totalTimeMs,
        apiWaitTimeMs,
        agentCoreTimeMs: totalTimeMs - apiWaitTimeMs,
        apiCalls: agentTiming.api_calls ?? 0,
        peakMemoryMb: 0, // TODO: OS-level memory tracking
        bugsFixed: correctness.bugsFixed,
        totalBugs: correctness.totalBugs,
        correctnessScore: correctness.bugsFixed / correctness.totalBugs,
        toolExecutionTimes: agentTiming.tool_executions ?? {},
      };

      results.push(result);

      console.log(`\n[RESULT] ${lang.name}:`);
      console.log(`  Total Time: ${(result.totalTimeMs / 1000).toFixed(2)}s`);
      console.log(`  API Wait:   ${(result.apiWaitTimeMs / 1000).toFixed(2)}s`);
      console.log(`  Core Time:  ${(result.agentCoreTimeMs / 1000).toFixed(2)}s ← THE BENCHMARK`);
      console.log(`  Bugs Fixed: ${result.bugsFixed}/${result.totalBugs}`);

    } catch (err: any) {
      console.error(`  ✗ ${lang.name} agent failed: ${err.message}`);
    }

    // Clean up work dir
    fs.rmSync(workDir, { recursive: true, force: true });
  }

  // Stop mock API
  mockApiProcess.kill();

  // Generate report
  if (results.length > 0) {
    const run: BenchmarkRun = {
      runId: `run-${new Date().toISOString().replace(/[:.]/g, '-')}`,
      config: {
        responseDelayMs: config.responseDelayMs,
        targetProjectSeed: 42,
        transcriptVersion: '1.0.0',
      },
      results,
    };

    const report = generateReport(run);
    console.log('\n' + report);

    // Save results
    const resultsPath = path.join(ROOT, 'benchmark', 'results', `${run.runId}.json`);
    fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
    fs.writeFileSync(resultsPath, JSON.stringify(run, null, 2));
    console.log(`\nResults saved to: ${resultsPath}`);
  }
}

function startMockApi(config: BenchmarkConfig): ChildProcess {
  const mockApiCwd = path.join(ROOT, 'mock-api');

  // Build mock API if needed
  try {
    execSync('npm run build', { cwd: mockApiCwd, stdio: 'pipe' });
  } catch {
    console.warn('Mock API build failed, trying to run with ts-node...');
  }

  const proc = spawn('node', ['dist/index.js'], {
    cwd: mockApiCwd,
    env: {
      ...process.env,
      PORT: String(config.mockApiPort),
      RESPONSE_DELAY_MS: String(config.responseDelayMs),
      TRANSCRIPT_PATH: config.transcriptPath,
      LOG_LEVEL: 'info',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  proc.stdout?.on('data', (data: Buffer) => {
    process.stdout.write(`  [Mock API] ${data.toString()}`);
  });

  proc.stderr?.on('data', (data: Buffer) => {
    process.stderr.write(`  [Mock API ERR] ${data.toString()}`);
  });

  return proc;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
