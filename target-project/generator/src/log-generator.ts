import * as fs from 'fs';
import * as path from 'path';
import { SeededRandom } from './seeded-random';
import { BugDefinition } from './bug-injector';

const LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
const SERVICES = [
  'auth-service', 'billing-service', 'inventory-service', 'notification-service',
  'reporting-service', 'search-service', 'shipping-service', 'user-service',
  'analytics-service', 'integration-service', 'api-gateway', 'cache-service',
  'queue-worker', 'scheduler', 'health-monitor'
];

const NORMAL_MESSAGES = [
  'Request processed successfully',
  'Cache hit for key {key}',
  'Database query completed in {ms}ms',
  'User session refreshed',
  'Background job completed',
  'Health check passed',
  'Connection pool status: {n} active, {m} idle',
  'Rate limit check passed for {ip}',
  'Configuration reloaded',
  'Metrics flushed to aggregator',
  'WebSocket connection established',
  'JWT token validated successfully',
  'File upload completed: {size} bytes',
  'Email notification queued',
  'Audit log entry created',
  'Feature flag evaluated: {flag} = {value}',
  'Circuit breaker status: closed',
  'Distributed lock acquired: {resource}',
  'Batch processing started: {count} items',
  'API response time: {ms}ms (p99: {p99}ms)',
];

export function generateLogs(
  outputDir: string,
  rng: SeededRandom,
  bugs: BugDefinition[],
  targetSizeMb: number = 50
): void {
  const logsDir = path.join(outputDir, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });

  const appLogPath = path.join(logsDir, 'application.log');
  const errorLogPath = path.join(logsDir, 'error.log');

  const appStream = fs.createWriteStream(appLogPath);
  const errorStream = fs.createWriteStream(errorLogPath);

  const targetBytes = targetSizeMb * 1024 * 1024;
  let totalBytes = 0;
  let lineCount = 0;

  // Base timestamp: 2026-03-01 00:00:00 UTC
  let timestamp = new Date('2026-03-01T00:00:00Z').getTime();

  // Generate error patterns from bugs (these get sprinkled throughout the log)
  const bugErrors = bugs.map(bug => ({
    pattern: bug.relatedLogPattern,
    file: bug.file,
    service: rng.pick(SERVICES),
    frequency: rng.int(3, 10), // how many times this error appears in the log
  }));

  // Track how many times each bug error has been emitted
  const errorCounts = new Map<string, number>();
  bugErrors.forEach(e => errorCounts.set(e.pattern, 0));

  while (totalBytes < targetBytes) {
    // Advance timestamp by 1-5000ms
    timestamp += rng.int(1, 5000);
    const ts = new Date(timestamp).toISOString();

    // Decide if this is a normal log or a bug-related error
    const roll = rng.next();
    let line: string;

    if (roll < 0.005) {
      // Bug-related error (~0.5% of lines)
      const bugError = rng.pick(bugErrors);
      const current = errorCounts.get(bugError.pattern) ?? 0;
      if (current < bugError.frequency) {
        errorCounts.set(bugError.pattern, current + 1);
        const traceId = rng.identifier(16);
        line = `${ts} ERROR [${bugError.service}] [trace:${traceId}] ${bugError.pattern} | source: ${bugError.file}`;
        errorStream.write(line + '\n');
      } else {
        // Already emitted enough of this error, write a normal error instead
        line = `${ts} ERROR [${rng.pick(SERVICES)}] [trace:${rng.identifier(16)}] Transient connection timeout after 30000ms`;
        errorStream.write(line + '\n');
      }
    } else if (roll < 0.02) {
      // Generic error (~1.5% of lines)
      const genericErrors = [
        'Connection timeout after 30000ms',
        'Rate limit exceeded for client {ip}',
        'Failed to parse JSON payload: unexpected token',
        'Database connection pool exhausted',
        'Memory usage exceeds threshold: {pct}%',
        'TLS handshake failed: certificate expired',
        'Queue message processing failed, retrying (attempt {n}/3)',
        'External API returned 503: Service Unavailable',
      ];
      const msg = rng.pick(genericErrors)
        .replace('{ip}', `10.${rng.int(0,255)}.${rng.int(0,255)}.${rng.int(0,255)}`)
        .replace('{pct}', String(rng.int(85, 99)))
        .replace('{n}', String(rng.int(1, 3)));
      line = `${ts} ERROR [${rng.pick(SERVICES)}] [trace:${rng.identifier(16)}] ${msg}`;
      errorStream.write(line + '\n');
    } else if (roll < 0.08) {
      // Warning (~6% of lines)
      const warnings = [
        'Slow query detected: {ms}ms (threshold: 1000ms)',
        'Retry attempt {n}/3 for external service call',
        'Cache miss rate above threshold: {pct}%',
        'Deprecated API endpoint called: {endpoint}',
        'Connection pool nearing capacity: {n}/{max}',
      ];
      const msg = rng.pick(warnings)
        .replace('{ms}', String(rng.int(1000, 5000)))
        .replace('{n}', String(rng.int(1, 3)))
        .replace('{max}', '100')
        .replace('{pct}', String(rng.int(60, 95)))
        .replace('{endpoint}', `/api/v1/${rng.identifier(6)}`);
      line = `${ts} WARN  [${rng.pick(SERVICES)}] [trace:${rng.identifier(16)}] ${msg}`;
    } else if (roll < 0.35) {
      // Debug (~27% of lines)
      const debugMsgs = [
        `Entering method ${rng.camelCase()} with args: [${rng.int(1, 100)}]`,
        `SQL: SELECT * FROM ${rng.identifier(6)} WHERE id = '${rng.identifier(8)}' LIMIT 100`,
        `HTTP ${rng.pick(['GET', 'POST', 'PUT', 'DELETE'])} /api/v2/${rng.identifier(6)}/${rng.identifier(8)} - ${rng.pick(['200', '201', '204'])} ${rng.int(1, 500)}ms`,
        `Cache SET ${rng.identifier(10)} TTL=${rng.int(60, 3600)}s size=${rng.int(100, 50000)}b`,
        `Worker thread ${rng.int(1, 16)} picked up job ${rng.identifier(12)}`,
      ];
      line = `${ts} DEBUG [${rng.pick(SERVICES)}] [trace:${rng.identifier(16)}] ${rng.pick(debugMsgs)}`;
    } else {
      // Info (~65% of lines)
      const msg = rng.pick(NORMAL_MESSAGES)
        .replace('{key}', rng.identifier(10))
        .replace('{ms}', String(rng.int(1, 200)))
        .replace('{p99}', String(rng.int(200, 2000)))
        .replace('{n}', String(rng.int(5, 50)))
        .replace('{m}', String(rng.int(10, 100)))
        .replace('{ip}', `10.${rng.int(0,255)}.${rng.int(0,255)}.${rng.int(0,255)}`)
        .replace('{size}', String(rng.int(1024, 10485760)))
        .replace('{flag}', rng.identifier(8))
        .replace('{value}', String(rng.next() > 0.5))
        .replace('{resource}', rng.identifier(10))
        .replace('{count}', String(rng.int(10, 10000)));
      line = `${ts} INFO  [${rng.pick(SERVICES)}] [trace:${rng.identifier(16)}] ${msg}`;
    }

    appStream.write(line + '\n');
    totalBytes += Buffer.byteLength(line + '\n');
    lineCount++;

    // Progress logging every 100K lines
    if (lineCount % 100000 === 0) {
      const mbWritten = (totalBytes / (1024 * 1024)).toFixed(1);
      process.stdout.write(`  Log generation: ${mbWritten}MB / ${targetSizeMb}MB (${lineCount} lines)\r`);
    }
  }

  appStream.end();
  errorStream.end();

  console.log(`  Generated application.log: ${(totalBytes / (1024 * 1024)).toFixed(1)}MB, ${lineCount} lines`);

  // Ensure all bug errors were emitted at least once
  for (const [pattern, count] of errorCounts) {
    if (count === 0) {
      const line = `${new Date(timestamp + 1000).toISOString()} ERROR [${rng.pick(SERVICES)}] [trace:${rng.identifier(16)}] ${pattern}`;
      fs.appendFileSync(appLogPath, line + '\n');
      fs.appendFileSync(errorLogPath, line + '\n');
    }
  }
}
