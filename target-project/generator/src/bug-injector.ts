import * as fs from 'fs';
import * as path from 'path';
import { SeededRandom } from './seeded-random';
import { GeneratedFile } from './file-generator';

export interface BugDefinition {
  id: string;
  category: 'type_error' | 'null_reference' | 'off_by_one' | 'config_error' | 'logic_error';
  severity: 'critical' | 'high' | 'medium';
  file: string;
  line: number;
  description: string;
  buggyCode: string;
  fixedCode: string;
  errorSignature: string;
  relatedLogPattern: string;
  discoveryHint: string;
}

/**
 * Injects exactly 15 bugs (3 per category) into generated files.
 * Returns the bug definitions for the manifest.
 */
export function injectBugs(
  outputDir: string,
  files: GeneratedFile[],
  rng: SeededRandom
): BugDefinition[] {
  const bugs: BugDefinition[] = [];

  // Filter to only module files (most realistic bug targets)
  const moduleFiles = files.filter(f => f.category === 'module' && f.lineCount > 30);
  rng.shuffle(moduleFiles);

  // 3 Type Errors
  for (let i = 0; i < 3; i++) {
    const file = moduleFiles[i];
    const bug = injectTypeError(outputDir, file, i, rng);
    bugs.push(bug);
  }

  // 3 Null Reference Errors
  for (let i = 0; i < 3; i++) {
    const file = moduleFiles[3 + i];
    const bug = injectNullReference(outputDir, file, i, rng);
    bugs.push(bug);
  }

  // 3 Off-by-One Errors
  for (let i = 0; i < 3; i++) {
    const file = moduleFiles[6 + i];
    const bug = injectOffByOne(outputDir, file, i, rng);
    bugs.push(bug);
  }

  // 3 Config Errors (injected into generated config files)
  for (let i = 0; i < 3; i++) {
    const bug = injectConfigError(outputDir, i, rng);
    bugs.push(bug);
  }

  // 3 Logic Errors
  for (let i = 0; i < 3; i++) {
    const file = moduleFiles[9 + i];
    const bug = injectLogicError(outputDir, file, i, rng);
    bugs.push(bug);
  }

  return bugs;
}

function injectTypeError(outputDir: string, file: GeneratedFile, index: number, rng: SeededRandom): BugDefinition {
  const filePath = path.join(outputDir, file.relativePath);
  let content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Find a line with a numeric operation and introduce a type error
  const fixedCode = `    const total = amount + tax;`;
  const buggyCode = `    const total = parseFloat(String(amount)) + tax;`;

  // Insert the buggy code at a reasonable position
  const insertLine = Math.min(25 + index * 3, lines.length - 5);
  const originalLine = lines[insertLine];
  lines[insertLine] = buggyCode;

  // Also add the variable declarations above
  lines.splice(insertLine, 0, `    const amount: number = ${rng.int(100, 9999)};`);
  lines.splice(insertLine + 1, 0, `    const tax: number = ${rng.int(1, 30)};`);

  fs.writeFileSync(filePath, lines.join('\n'));

  return {
    id: `bug-${String(index + 1).padStart(3, '0')}`,
    category: 'type_error',
    severity: 'critical',
    file: file.relativePath,
    line: insertLine + 3, // +2 for inserted lines, +1 for 1-indexed
    description: `parseFloat(String(...)) on an already numeric value causes unnecessary type coercion and potential NaN propagation`,
    buggyCode,
    fixedCode,
    errorSignature: 'NaN propagation in calculations',
    relatedLogPattern: `WARN: Calculation result is NaN for module ${path.basename(file.relativePath, '.ts')}`,
    discoveryHint: 'Search logs for NaN warnings, trace to parseFloat(String(...)) pattern',
  };
}

function injectNullReference(outputDir: string, file: GeneratedFile, index: number, rng: SeededRandom): BugDefinition {
  const filePath = path.join(outputDir, file.relativePath);
  let content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const buggyCode = `    const value = config.settings.database.host.toUpperCase();`;
  const fixedCode = `    const value = config?.settings?.database?.host?.toUpperCase() ?? 'LOCALHOST';`;

  const insertLine = Math.min(20 + index * 5, lines.length - 5);
  lines.splice(insertLine, 0, `    const config: any = getConfig();`);
  lines.splice(insertLine + 1, 0, buggyCode);

  // Add a getConfig function that can return partial objects
  lines.push('');
  lines.push(`function getConfig(): any {`);
  lines.push(`  // In production, settings may be partially loaded`);
  lines.push(`  return { settings: { database: null } };`);
  lines.push('}');

  fs.writeFileSync(filePath, lines.join('\n'));

  return {
    id: `bug-${String(index + 4).padStart(3, '0')}`,
    category: 'null_reference',
    severity: 'critical',
    file: file.relativePath,
    line: insertLine + 2,
    description: 'Accessing deeply nested property without null checks causes TypeError when config is partially loaded',
    buggyCode,
    fixedCode,
    errorSignature: "TypeError: Cannot read properties of null (reading 'host')",
    relatedLogPattern: `ERROR: TypeError: Cannot read properties of null in ${path.basename(file.relativePath, '.ts')}`,
    discoveryHint: 'Search error logs for TypeError null reference, trace to config access pattern',
  };
}

function injectOffByOne(outputDir: string, file: GeneratedFile, index: number, rng: SeededRandom): BugDefinition {
  const filePath = path.join(outputDir, file.relativePath);
  let content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const buggyCode = `    for (let i = 0; i <= items.length; i++) {`;
  const fixedCode = `    for (let i = 0; i < items.length; i++) {`;

  const insertLine = Math.min(18 + index * 4, lines.length - 5);
  lines.splice(insertLine, 0, `    const items = Array.from({ length: ${rng.int(10, 100)} }, (_, i) => ({ id: i, name: 'item-' + i }));`);
  lines.splice(insertLine + 1, 0, buggyCode);
  lines.splice(insertLine + 2, 0, `      const item = items[i];`);
  lines.splice(insertLine + 3, 0, `      processItem(item.id, item.name);`);
  lines.splice(insertLine + 4, 0, `    }`);

  // Add processItem function
  lines.push('');
  lines.push(`function processItem(id: number, name: string): void {`);
  lines.push(`  // Process the item`);
  lines.push(`  console.log(\`Processing item \${id}: \${name}\`);`);
  lines.push('}');

  fs.writeFileSync(filePath, lines.join('\n'));

  return {
    id: `bug-${String(index + 7).padStart(3, '0')}`,
    category: 'off_by_one',
    severity: 'high',
    file: file.relativePath,
    line: insertLine + 2,
    description: 'Loop uses <= instead of <, causing array index out of bounds on the last iteration',
    buggyCode,
    fixedCode,
    errorSignature: "TypeError: Cannot read properties of undefined (reading 'id')",
    relatedLogPattern: `ERROR: Array index out of bounds in ${path.basename(file.relativePath, '.ts')} loop iteration`,
    discoveryHint: 'Search for off-by-one errors: loop condition uses <= with array.length',
  };
}

function injectConfigError(outputDir: string, index: number, rng: SeededRandom): BugDefinition {
  const configDir = path.join(outputDir, 'config', 'environments', 'production');
  fs.mkdirSync(configDir, { recursive: true });

  const configNames = ['database', 'cache', 'api-gateway'];
  const configName = configNames[index];
  const configPath = path.join(configDir, `${configName}.json`);

  // Generate a deeply nested config with one wrong value
  const configs: Record<string, any> = {
    database: {
      primary: {
        host: 'db-primary.internal',
        port: 5432,
        pool: {
          min: 5,
          max: 50, // This will be the bug: should be 50 but set to 0
          idleTimeoutMs: 10000,
          connectionTimeoutMs: 5000,
          settings: {
            ssl: { enabled: true, rejectUnauthorized: true },
            replication: { enabled: true, readReplicas: 3 }
          }
        },
        credentials: { user: 'app_user', database: 'production' }
      },
      replica: {
        host: 'db-replica.internal',
        port: 5432,
        pool: { min: 2, max: 20 }
      }
    },
    cache: {
      redis: {
        cluster: {
          nodes: ['cache-1:6379', 'cache-2:6379', 'cache-3:6379'],
          options: {
            maxRedirections: 16,
            retryDelayMs: 100, // Bug: should be 100 but set to -1
            scaleReads: 'slave',
            settings: {
              keyPrefix: 'app:',
              serializer: 'json',
              compression: { enabled: true, algorithm: 'gzip', level: 6 }
            }
          }
        },
        ttl: { default: 3600, session: 86400, static: 604800 }
      }
    },
    'api-gateway': {
      routes: {
        public: { rateLimit: { windowMs: 60000, maxRequests: 100 } },
        authenticated: { rateLimit: { windowMs: 60000, maxRequests: 1000 } },
        internal: { rateLimit: { windowMs: 60000, maxRequests: 10000 } }
      },
      cors: {
        origins: ['https://app.example.com'],
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        maxAge: 86400 // Bug: should be 86400 but set to -86400
      },
      timeout: { read: 30000, write: 60000, idle: 120000 }
    }
  };

  const config = configs[configName];

  // Apply the bug for the current index only
  let bugDetail: { buggyValue: any; fixedValue: any; path: string; description: string };

  if (index === 0) {
    config.primary.pool.max = 0;
    bugDetail = {
      buggyValue: 0,
      fixedValue: 50,
      path: 'primary.pool.max',
      description: 'Database connection pool max set to 0, preventing any connections',
    };
  } else if (index === 1) {
    config.redis.cluster.options.retryDelayMs = -1;
    bugDetail = {
      buggyValue: -1,
      fixedValue: 100,
      path: 'redis.cluster.options.retryDelayMs',
      description: 'Redis retry delay set to -1, causing infinite retry loop',
    };
  } else {
    config.cors.maxAge = -86400;
    bugDetail = {
      buggyValue: -86400,
      fixedValue: 86400,
      path: 'cors.maxAge',
      description: 'CORS maxAge set to negative value, disabling preflight caching',
    };
  }

  // Write the buggy config (with lots of padding to make file large)
  const paddedConfig = addConfigPadding(config, rng);
  fs.writeFileSync(configPath, JSON.stringify(paddedConfig, null, 2));

  const relativePath = `config/environments/production/${configName}.json`;

  return {
    id: `bug-${String(index + 10).padStart(3, '0')}`,
    category: 'config_error',
    severity: 'critical',
    file: relativePath,
    line: -1, // JSON doesn't have meaningful line numbers
    description: bugDetail.description,
    buggyCode: JSON.stringify(bugDetail.buggyValue),
    fixedCode: JSON.stringify(bugDetail.fixedValue),
    errorSignature: `Configuration error: ${bugDetail.path} has invalid value`,
    relatedLogPattern: `ERROR: Invalid configuration value at ${bugDetail.path}: ${bugDetail.buggyValue}`,
    discoveryHint: `Check production config files for invalid numeric values (0, negative numbers)`,
  };
}

function injectLogicError(outputDir: string, file: GeneratedFile, index: number, rng: SeededRandom): BugDefinition {
  const filePath = path.join(outputDir, file.relativePath);
  let content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const logicBugs = [
    {
      buggyCode: `    if (userRole !== 'admin' || userRole !== 'superadmin') {`,
      fixedCode: `    if (userRole !== 'admin' && userRole !== 'superadmin') {`,
      description: 'OR instead of AND in negated condition — always evaluates to true, granting access to all users',
      errorSignature: 'Authorization bypass: all users pass admin check',
      pattern: 'Security: Unauthorized access detected, role check bypassed',
    },
    {
      buggyCode: `    const discount = price * quantity > 100 ? 0.1 : 0.2;`,
      fixedCode: `    const discount = price * quantity > 100 ? 0.2 : 0.1;`,
      description: 'Discount tiers are inverted — larger orders get smaller discount',
      errorSignature: 'Business logic error: discount calculation inverted',
      pattern: 'WARN: Discount calculation mismatch for large orders',
    },
    {
      buggyCode: `    const isExpired = expiryDate > new Date();`,
      fixedCode: `    const isExpired = expiryDate < new Date();`,
      description: 'Comparison operator is wrong — treats future dates as expired and past dates as valid',
      errorSignature: 'Date comparison error: expiry check is inverted',
      pattern: 'ERROR: Valid items marked as expired, expired items still active',
    },
  ];

  const bug = logicBugs[index];
  const insertLine = Math.min(22 + index * 3, lines.length - 5);

  // Add context variables
  if (index === 0) {
    lines.splice(insertLine, 0, `    const userRole: string = getUserRole();`);
  } else if (index === 1) {
    lines.splice(insertLine, 0, `    const price: number = ${rng.int(10, 500)};`);
    lines.splice(insertLine + 1, 0, `    const quantity: number = ${rng.int(1, 50)};`);
  } else {
    lines.splice(insertLine, 0, `    const expiryDate: Date = new Date('2026-12-31');`);
  }

  // Insert the buggy code
  const bugLineOffset = index === 1 ? 2 : 1;
  lines.splice(insertLine + bugLineOffset, 0, bug.buggyCode);
  lines.splice(insertLine + bugLineOffset + 1, 0, `      // Logic gate passed`);
  lines.splice(insertLine + bugLineOffset + 2, 0, `    }`);

  // Add helper if needed
  if (index === 0) {
    lines.push('');
    lines.push(`function getUserRole(): string {`);
    lines.push(`  return 'viewer'; // Should be denied but passes due to bug`);
    lines.push('}');
  }

  fs.writeFileSync(filePath, lines.join('\n'));

  return {
    id: `bug-${String(index + 13).padStart(3, '0')}`,
    category: 'logic_error',
    severity: index === 0 ? 'critical' : 'high',
    file: file.relativePath,
    line: insertLine + bugLineOffset + 1,
    description: bug.description,
    buggyCode: bug.buggyCode,
    fixedCode: bug.fixedCode,
    errorSignature: bug.errorSignature,
    relatedLogPattern: bug.pattern,
    discoveryHint: `Search for common logic errors: inverted conditions, wrong operators`,
  };
}

function addConfigPadding(config: any, rng: SeededRandom): any {
  // Add extra nested fields to make config files larger (~500KB each)
  const padded = JSON.parse(JSON.stringify(config));

  // Add monitoring section
  padded.monitoring = {};
  for (let i = 0; i < 50; i++) {
    const metricName = `metric_${rng.identifier(8)}`;
    padded.monitoring[metricName] = {
      enabled: rng.next() > 0.3,
      interval: rng.int(10, 300),
      threshold: {
        warning: rng.int(50, 80),
        critical: rng.int(80, 99),
        labels: Object.fromEntries(
          Array.from({ length: rng.int(3, 10) }, () => [rng.identifier(6), rng.identifier(10)])
        ),
      },
    };
  }

  // Add feature flags section
  padded.featureFlags = {};
  for (let i = 0; i < 100; i++) {
    padded.featureFlags[`flag_${rng.identifier(10)}`] = {
      enabled: rng.next() > 0.5,
      rolloutPercentage: rng.int(0, 100),
      targetGroups: Array.from({ length: rng.int(1, 5) }, () => rng.identifier(8)),
    };
  }

  return padded;
}
