/**
 * Report Generator — Produces comparison tables from benchmark results.
 */

export interface BenchmarkResult {
  language: string;
  timestamp: string;
  totalTimeMs: number;
  apiWaitTimeMs: number;
  agentCoreTimeMs: number;
  apiCalls: number;
  peakMemoryMb: number;
  bugsFixed: number;
  totalBugs: number;
  correctnessScore: number;
  toolExecutionTimes: Record<string, ToolTiming>;
}

interface ToolTiming {
  count: number;
  total_ms: number;
  times_ms: number[];
}

export interface BenchmarkRun {
  runId: string;
  config: {
    responseDelayMs: number;
    targetProjectSeed: number;
    transcriptVersion: string;
  };
  results: BenchmarkResult[];
}

export function generateReport(run: BenchmarkRun): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('╔══════════════════════════════════════════════════════════════╗');
  lines.push('║            AGENT VS AGENT — BENCHMARK RESULTS              ║');
  lines.push('╚══════════════════════════════════════════════════════════════╝');
  lines.push('');
  lines.push(`Run ID: ${run.runId}`);
  lines.push(`API Delay: ${run.config.responseDelayMs}ms per call`);
  lines.push(`Seed: ${run.config.targetProjectSeed}`);
  lines.push('');

  // Sort by agentCoreTimeMs (lower is better)
  const sorted = [...run.results].sort((a, b) => a.agentCoreTimeMs - b.agentCoreTimeMs);

  // Main results table
  lines.push('┌─────────────┬────────────┬────────────┬────────────┬──────────┬───────────┐');
  lines.push('│ Language    │ Total Time │  API Wait  │ Core Time  │ API Calls│ Bugs Fixed│');
  lines.push('├─────────────┼────────────┼────────────┼────────────┼──────────┼───────────┤');

  for (const r of sorted) {
    const lang = r.language.padEnd(11);
    const total = `${(r.totalTimeMs / 1000).toFixed(2)}s`.padStart(10);
    const apiWait = `${(r.apiWaitTimeMs / 1000).toFixed(2)}s`.padStart(10);
    const core = `${(r.agentCoreTimeMs / 1000).toFixed(2)}s`.padStart(10);
    const calls = String(r.apiCalls).padStart(8);
    const bugs = `${r.bugsFixed}/${r.totalBugs}`.padStart(9);
    lines.push(`│ ${lang} │ ${total} │ ${apiWait} │ ${core} │ ${calls} │ ${bugs} │`);
  }

  lines.push('└─────────────┴────────────┴────────────┴────────────┴──────────┴───────────┘');
  lines.push('');

  // Winner
  if (sorted.length > 0) {
    const winner = sorted[0];
    lines.push(`🏆 FASTEST CORE TIME: ${winner.language.toUpperCase()} (${(winner.agentCoreTimeMs / 1000).toFixed(2)}s)`);

    if (sorted.length > 1) {
      const slowest = sorted[sorted.length - 1];
      const speedup = (slowest.agentCoreTimeMs / winner.agentCoreTimeMs).toFixed(1);
      lines.push(`   ${speedup}x faster than ${slowest.language}`);
    }
    lines.push('');
  }

  // Per-tool breakdown
  lines.push('Per-Tool Execution Times (avg ms):');
  lines.push('');

  const toolNames = new Set<string>();
  for (const r of sorted) {
    for (const name of Object.keys(r.toolExecutionTimes)) {
      toolNames.add(name);
    }
  }

  const toolHeader = '│ Tool'.padEnd(20) + sorted.map(r => `│ ${r.language.padEnd(10)}`).join('') + '│';
  const toolSep = '├' + '─'.repeat(19) + sorted.map(() => '┼' + '─'.repeat(11)).join('') + '┤';
  lines.push('┌' + '─'.repeat(19) + sorted.map(() => '┬' + '─'.repeat(11)).join('') + '┐');
  lines.push(toolHeader);
  lines.push(toolSep);

  for (const tool of toolNames) {
    let row = `│ ${tool.padEnd(17)}`;
    for (const r of sorted) {
      const timing = r.toolExecutionTimes[tool];
      if (timing && timing.count > 0) {
        const avg = (timing.total_ms / timing.count).toFixed(1);
        row += `│ ${(avg + 'ms').padStart(10)}`;
      } else {
        row += `│ ${'-'.padStart(10)}`;
      }
    }
    row += '│';
    lines.push(row);
  }

  lines.push('└' + '─'.repeat(19) + sorted.map(() => '┴' + '─'.repeat(11)).join('') + '┘');
  lines.push('');

  return lines.join('\n');
}
