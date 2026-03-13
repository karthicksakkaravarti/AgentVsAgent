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
 * Injects exactly 50 bugs (10 per category) into generated files.
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

  // 10 Type Errors
  for (let i = 0; i < 10; i++) {
    const file = moduleFiles[i];
    const bug = injectTypeError(outputDir, file, i, rng);
    bugs.push(bug);
  }

  // 10 Null Reference Errors
  for (let i = 0; i < 10; i++) {
    const file = moduleFiles[10 + i];
    const bug = injectNullReference(outputDir, file, i, rng);
    bugs.push(bug);
  }

  // 10 Off-by-One Errors
  for (let i = 0; i < 10; i++) {
    const file = moduleFiles[20 + i];
    const bug = injectOffByOne(outputDir, file, i, rng);
    bugs.push(bug);
  }

  // 10 Config Errors (injected into generated config files)
  for (let i = 0; i < 10; i++) {
    const bug = injectConfigError(outputDir, i, rng);
    bugs.push(bug);
  }

  // 10 Logic Errors
  for (let i = 0; i < 10; i++) {
    const file = moduleFiles[30 + i];
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
    severity: index < 3 ? 'critical' : 'high',
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
    id: `bug-${String(index + 11).padStart(3, '0')}`,
    category: 'null_reference',
    severity: index < 3 ? 'critical' : 'high',
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
    id: `bug-${String(index + 21).padStart(3, '0')}`,
    category: 'off_by_one',
    severity: index < 3 ? 'high' : 'medium',
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
  // Define all 10 config bugs
  // Indices 0-5: production environment
  // Indices 6-9: staging environment
  const bugConfigs: Array<{
    env: string;
    configType: string;
    path: string;
    buggyValue: any;
    fixedValue: any;
    description: string;
    applyBug: (config: any) => void;
  }> = [
    // Production bugs (0-5)
    {
      env: 'production',
      configType: 'database',
      path: 'primary.pool.max',
      buggyValue: 0,
      fixedValue: 50,
      description: 'Database connection pool max set to 0, preventing any connections',
      applyBug: (c) => { c.primary.pool.max = 0; }
    },
    {
      env: 'production',
      configType: 'cache',
      path: 'redis.cluster.options.retryDelayMs',
      buggyValue: -1,
      fixedValue: 100,
      description: 'Redis retry delay set to -1, causing infinite retry loop',
      applyBug: (c) => { c.redis.cluster.options.retryDelayMs = -1; }
    },
    {
      env: 'production',
      configType: 'api-gateway',
      path: 'cors.maxAge',
      buggyValue: -86400,
      fixedValue: 86400,
      description: 'CORS maxAge set to negative value, disabling preflight caching',
      applyBug: (c) => { c.cors.maxAge = -86400; }
    },
    {
      env: 'production',
      configType: 'logging',
      path: 'maxFileSizeMb',
      buggyValue: 0,
      fixedValue: 100,
      description: 'Log max file size set to 0, preventing any log writing',
      applyBug: (c) => { c.maxFileSizeMb = 0; }
    },
    {
      env: 'production',
      configType: 'security',
      path: 'sessionTimeoutMs',
      buggyValue: -1,
      fixedValue: 3600000,
      description: 'Session timeout set to negative value, causing immediate expiration',
      applyBug: (c) => { c.sessionTimeoutMs = -1; }
    },
    {
      env: 'production',
      configType: 'messaging',
      path: 'retryAttempts',
      buggyValue: 0,
      fixedValue: 3,
      description: 'Message retry attempts set to 0, disabling retry on failure',
      applyBug: (c) => { c.retryAttempts = 0; }
    },
    // Staging bugs (6-9)
    {
      env: 'staging',
      configType: 'database',
      path: 'primary.pool.max',
      buggyValue: 0,
      fixedValue: 20,
      description: 'Staging database connection pool max set to 0, preventing any connections',
      applyBug: (c) => { c.primary.pool.max = 0; }
    },
    {
      env: 'staging',
      configType: 'cache',
      path: 'redis.cluster.options.retryDelayMs',
      buggyValue: -1,
      fixedValue: 100,
      description: 'Staging Redis retry delay set to -1, causing infinite retry loop',
      applyBug: (c) => { c.redis.cluster.options.retryDelayMs = -1; }
    },
    {
      env: 'staging',
      configType: 'api-gateway',
      path: 'cors.maxAge',
      buggyValue: -86400,
      fixedValue: 86400,
      description: 'Staging CORS maxAge set to negative value, disabling preflight caching',
      applyBug: (c) => { c.cors.maxAge = -86400; }
    },
    {
      env: 'staging',
      configType: 'logging',
      path: 'maxFileSizeMb',
      buggyValue: 0,
      fixedValue: 50,
      description: 'Staging log max file size set to 0, preventing any log writing',
      applyBug: (c) => { c.maxFileSizeMb = 0; }
    }
  ];

  const bug = bugConfigs[index];
  const configDir = path.join(outputDir, 'config', 'environments', bug.env);
  fs.mkdirSync(configDir, { recursive: true });

  // Generate base config based on type
  const config = generateBaseConfig(bug.configType, bug.env, rng);
  bug.applyBug(config);

  // Write the buggy config (with padding to make file larger)
  const paddedConfig = addConfigPadding(config, rng);
  const configPath = path.join(configDir, `${bug.configType}.json`);
  fs.writeFileSync(configPath, JSON.stringify(paddedConfig, null, 2));

  const relativePath = `config/environments/${bug.env}/${bug.configType}.json`;

  return {
    id: `bug-${String(index + 31).padStart(3, '0')}`,
    category: 'config_error',
    severity: index < 3 ? 'critical' : 'high',
    file: relativePath,
    line: -1,
    description: bug.description,
    buggyCode: JSON.stringify(bug.buggyValue),
    fixedCode: JSON.stringify(bug.fixedValue),
    errorSignature: `Configuration error: ${bug.path} has invalid value`,
    relatedLogPattern: `ERROR: Invalid configuration value at ${bug.path}: ${bug.buggyValue}`,
    discoveryHint: `Check ${bug.env} config files for invalid numeric values (0, negative numbers)`,
  };
}

function generateBaseConfig(configType: string, env: string, rng: SeededRandom): any {
  const base: any = {
    environment: env,
    version: '1.0.0',
    updatedAt: new Date(2026, 2, rng.int(1, 12)).toISOString(),
  };

  switch (configType) {
    case 'database':
      return {
        ...base,
        primary: {
          host: `db-primary.${env}.internal`,
          port: 5432,
          pool: { min: 5, max: env === 'production' ? 50 : 20, idleTimeoutMs: 10000 },
          credentials: { user: `app_${env}`, database: `app_${env}` },
        },
        replica: {
          host: `db-replica.${env}.internal`,
          port: 5432,
          pool: { min: 1, max: env === 'production' ? 20 : 5 },
        },
      };
    case 'cache':
      return {
        ...base,
        redis: {
          cluster: {
            nodes: Array.from({ length: 3 }, (_, i) => `cache-${i + 1}.${env}:6379`),
            options: { maxRedirections: 16, retryDelayMs: 100 },
          },
          ttl: { default: 3600, session: 86400 },
        },
      };
    case 'api-gateway':
      return {
        ...base,
        routes: {
          public: { rateLimit: { windowMs: 60000, maxRequests: 100 } },
          authenticated: { rateLimit: { windowMs: 60000, maxRequests: 1000 } },
          internal: { rateLimit: { windowMs: 60000, maxRequests: 10000 } }
        },
        cors: {
          origins: [`https://${env}.example.com`],
          methods: ['GET', 'POST', 'PUT', 'DELETE'],
          maxAge: 86400
        },
        timeout: { read: 30000, write: 60000, idle: 120000 }
      };
    case 'logging':
      return {
        ...base,
        level: env === 'production' ? 'info' : 'debug',
        outputs: ['stdout', 'file', 'datadog'],
        file: { path: `/var/log/app/${env}.log`, maxSize: '100MB', maxFiles: 10 },
        maxFileSizeMb: 100,
        sampling: { rate: env === 'production' ? 0.1 : 1.0 },
      };
    case 'security':
      return {
        ...base,
        jwt: { issuer: `app-${env}`, expiresIn: '1h', algorithm: 'RS256' },
        cors: { origins: [`https://${env}.example.com`], maxAge: 86400 },
        rateLimit: { windowMs: 60000, max: env === 'production' ? 100 : 1000 },
        sessionTimeoutMs: 3600000,
      };
    case 'messaging':
      return {
        ...base,
        queue: {
          provider: 'rabbitmq',
          host: `mq.${env}.internal`,
          exchanges: ['events', 'commands', 'notifications'],
          prefetch: env === 'production' ? 10 : 1,
        },
        retryAttempts: 3,
      };
    default:
      return base;
  }
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
    {
      buggyCode: `    const isActive = status === 'active' || status === 'pending';`,
      fixedCode: `    const isActive = status === 'active';`,
      description: 'Condition includes pending status as active, allowing pending operations to proceed',
      errorSignature: 'Logic error: pending items treated as active',
      pattern: 'WARN: Pending status incorrectly marked as active',
    },
    {
      buggyCode: `    const shouldRetry = attemptCount < maxRetries || attemptCount === 0;`,
      fixedCode: `    const shouldRetry = attemptCount < maxRetries;`,
      description: 'Retry logic always retries when attemptCount is 0 regardless of maxRetries',
      errorSignature: 'Retry logic error: infinite retry possible',
      pattern: 'ERROR: Retry loop not terminating correctly',
    },
    {
      buggyCode: `    const total = subTotal + taxRate * subTotal - discount;`,
      fixedCode: `    const total = subTotal + taxRate * subTotal + discount;`,
      description: 'Discount is subtracted instead of added, giving incorrect totals',
      errorSignature: 'Calculation error: discount applied with wrong sign',
      pattern: 'WARN: Total calculation has incorrect sign for discount',
    },
    {
      buggyCode: `    const isEligible = age >= 18 && age <= 65 || age >= 70;`,
      fixedCode: `    const isEligible = (age >= 18 && age <= 65) || age >= 70;`,
      description: 'Missing parentheses in complex condition causes incorrect eligibility',
      errorSignature: 'Eligibility check error: age 66-69 incorrectly excluded',
      pattern: 'ERROR: Age eligibility logic incorrectly evaluated',
    },
    {
      buggyCode: `    const hasPermission = user.isAdmin && !user.isBlocked || user.isOwner;`,
      fixedCode: `    const hasPermission = (user.isAdmin && !user.isBlocked) || user.isOwner;`,
      description: 'Operator precedence causes wrong permission check - blocked admins bypass block',
      errorSignature: 'Permission check error: blocked admin has access',
      pattern: 'Security: Blocked user bypassed permission check',
    },
    {
      buggyCode: `    const isValidScore = score >= 0 || score <= 100;`,
      fixedCode: `    const isValidScore = score >= 0 && score <= 100;`,
      description: 'OR instead of AND allows any number to pass as valid score',
      errorSignature: 'Validation error: out-of-range scores accepted',
      pattern: 'WARN: Invalid score value passed validation',
    },
    {
      buggyCode: `    const nextStatus = currentStatus === 'open' ? 'closed' : 'open';`,
      fixedCode: `    const nextStatus = currentStatus === 'open' ? 'in_progress' : 'closed';`,
      description: 'Toggle logic incorrectly cycles open→closed→open instead of open→in_progress→closed',
      errorSignature: 'State machine error: invalid status transition',
      pattern: 'ERROR: Invalid status transition in workflow',
    },
  ];

  const bug = logicBugs[index];
  const insertLine = Math.min(22 + index * 3, lines.length - 5);

  // Add context variables based on bug type
  if (index === 0) {
    lines.splice(insertLine, 0, `    const userRole: string = getUserRole();`);
  } else if (index === 1) {
    lines.splice(insertLine, 0, `    const price: number = ${rng.int(10, 500)};`);
    lines.splice(insertLine + 1, 0, `    const quantity: number = ${rng.int(1, 50)};`);
  } else if (index === 2) {
    lines.splice(insertLine, 0, `    const expiryDate: Date = new Date('2026-12-31');`);
  } else if (index === 3) {
    lines.splice(insertLine, 0, `    const status: string = getStatus();`);
  } else if (index === 4) {
    lines.splice(insertLine, 0, `    const attemptCount: number = ${rng.int(0, 3)};`);
    lines.splice(insertLine + 1, 0, `    const maxRetries: number = ${rng.int(1, 3)};`);
  } else if (index === 5) {
    lines.splice(insertLine, 0, `    const subTotal: number = ${rng.int(50, 500)};`);
    lines.splice(insertLine + 1, 0, `    const taxRate: number = 0.08;`);
    lines.splice(insertLine + 2, 0, `    const discount: number = ${rng.int(5, 50)};`);
  } else if (index === 6) {
    lines.splice(insertLine, 0, `    const age: number = ${rng.int(18, 80)};`);
  } else if (index === 7) {
    lines.splice(insertLine, 0, `    const user = { isAdmin: false, isBlocked: true, isOwner: true };`);
  } else if (index === 8) {
    lines.splice(insertLine, 0, `    const score: number = ${rng.int(-10, 150)};`);
  } else {
    lines.splice(insertLine, 0, `    const currentStatus: string = getWorkflowStatus();`);
  }

  // Insert the buggy code
  const bugLineOffset = [1, 2, 1, 1, 2, 3, 1, 1, 1, 1][index];
  lines.splice(insertLine + bugLineOffset, 0, bug.buggyCode);
  lines.splice(insertLine + bugLineOffset + 1, 0, `      // Logic gate passed`);
  lines.splice(insertLine + bugLineOffset + 2, 0, `    }`);

  // Add helper functions for specific bugs
  if (index === 0) {
    lines.push('');
    lines.push(`function getUserRole(): string {`);
    lines.push(`  return 'viewer'; // Should be denied but passes due to bug`);
    lines.push('}');
  } else if (index === 3) {
    lines.push('');
    lines.push(`function getStatus(): string {`);
    lines.push(`  return 'pending'; // Incorrectly treated as active`);
    lines.push('}');
  } else if (index === 9) {
    lines.push('');
    lines.push(`function getWorkflowStatus(): string {`);
    lines.push(`  return 'open';`);
    lines.push('}');
  }

  // Add helper if needed
  if (index === 0) {
    lines.push('');
    lines.push(`function getUserRole(): string {`);
    lines.push(`  return 'viewer'; // Should be denied but passes due to bug`);
    lines.push('}');
  }

  fs.writeFileSync(filePath, lines.join('\n'));

  return {
    id: `bug-${String(index + 41).padStart(3, '0')}`,
    category: 'logic_error',
    severity: index < 3 ? 'critical' : (index < 6 ? 'high' : 'medium'),
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
