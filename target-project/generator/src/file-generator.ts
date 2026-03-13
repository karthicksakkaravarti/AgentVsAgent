import * as fs from 'fs';
import * as path from 'path';
import { SeededRandom } from './seeded-random';

const MODULES = [
  'auth', 'billing', 'inventory', 'notifications', 'reporting',
  'search', 'shipping', 'users', 'analytics', 'integrations'
];

const SUB_MODULES: Record<string, string[]> = {
  integrations: ['stripe', 'twilio', 'sendgrid', 'slack', 'github',
    'jira', 'aws', 'gcp', 'azure', 'datadog']
};

const CATEGORIES = ['utils', 'models', 'tests'];

export interface GeneratedFile {
  relativePath: string;
  absolutePath: string;
  module: string;
  category: string;
  lineCount: number;
}

export function generateFiles(outputDir: string, rng: SeededRandom): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // Generate module files (~500 per module = 5000 total)
  for (const mod of MODULES) {
    const subModules = SUB_MODULES[mod];
    if (subModules) {
      // Modules with sub-modules: 50 files per sub-module
      for (const sub of subModules) {
        for (let i = 0; i < 50; i++) {
          const file = generateModuleFile(outputDir, `modules/${mod}/${sub}`, i, rng);
          files.push(file);
        }
      }
    } else {
      // Regular modules: 500 files each
      for (let i = 0; i < 500; i++) {
        const file = generateModuleFile(outputDir, `modules/${mod}`, i, rng);
        files.push(file);
      }
    }
  }

  // Generate utility files (2000)
  for (let i = 0; i < 2000; i++) {
    const file = generateUtilFile(outputDir, i, rng);
    files.push(file);
  }

  // Generate model files (1000)
  for (let i = 0; i < 1000; i++) {
    const file = generateModelFile(outputDir, i, rng);
    files.push(file);
  }

  // Generate test files (2000)
  for (let i = 0; i < 2000; i++) {
    const file = generateTestFile(outputDir, i, rng);
    files.push(file);
  }

  return files;
}

function generateModuleFile(outputDir: string, modulePath: string, index: number, rng: SeededRandom): GeneratedFile {
  const fileName = `${rng.identifier(6)}-${index}.ts`;
  const relativePath = `src/${modulePath}/${fileName}`;
  const absolutePath = path.join(outputDir, relativePath);
  const content = generateModuleContent(modulePath, index, rng);

  ensureDir(path.dirname(absolutePath));
  fs.writeFileSync(absolutePath, content);

  return {
    relativePath,
    absolutePath,
    module: modulePath,
    category: 'module',
    lineCount: content.split('\n').length,
  };
}

function generateUtilFile(outputDir: string, index: number, rng: SeededRandom): GeneratedFile {
  const fileName = `${rng.identifier(6)}-util-${index}.ts`;
  const subDir = `sub${Math.floor(index / 100)}`;
  const relativePath = `src/utils/${subDir}/${fileName}`;
  const absolutePath = path.join(outputDir, relativePath);
  const content = generateUtilContent(index, rng);

  ensureDir(path.dirname(absolutePath));
  fs.writeFileSync(absolutePath, content);

  return {
    relativePath,
    absolutePath,
    module: 'utils',
    category: 'utils',
    lineCount: content.split('\n').length,
  };
}

function generateModelFile(outputDir: string, index: number, rng: SeededRandom): GeneratedFile {
  const fileName = `${rng.identifier(6)}-model-${index}.ts`;
  const subDir = `sub${Math.floor(index / 100)}`;
  const relativePath = `src/models/${subDir}/${fileName}`;
  const absolutePath = path.join(outputDir, relativePath);
  const content = generateModelContent(index, rng);

  ensureDir(path.dirname(absolutePath));
  fs.writeFileSync(absolutePath, content);

  return {
    relativePath,
    absolutePath,
    module: 'models',
    category: 'models',
    lineCount: content.split('\n').length,
  };
}

function generateTestFile(outputDir: string, index: number, rng: SeededRandom): GeneratedFile {
  const fileName = `${rng.identifier(6)}-test-${index}.test.ts`;
  const subDir = `sub${Math.floor(index / 200)}`;
  const relativePath = `src/tests/${subDir}/${fileName}`;
  const absolutePath = path.join(outputDir, relativePath);
  const content = generateTestContent(index, rng);

  ensureDir(path.dirname(absolutePath));
  fs.writeFileSync(absolutePath, content);

  return {
    relativePath,
    absolutePath,
    module: 'tests',
    category: 'tests',
    lineCount: content.split('\n').length,
  };
}

function generateModuleContent(modulePath: string, index: number, rng: SeededRandom): string {
  const className = rng.pascalCase();
  const methodCount = rng.int(8, 15);
  const lines: string[] = [];

  // Imports
  const importCount = rng.int(4, 10);
  for (let i = 0; i < importCount; i++) {
    const importName = rng.pascalCase();
    lines.push(`import { ${importName} } from '../${rng.identifier(5)}';`);
  }
  lines.push('');

  // Interface
  const interfaceName = `I${className}`;
  lines.push(`export interface ${interfaceName} {`);
  const propCount = rng.int(6, 14);
  const types = ['string', 'number', 'boolean', 'Date', 'string[]', 'Record<string, unknown>'];
  for (let i = 0; i < propCount; i++) {
    lines.push(`  ${rng.camelCase()}: ${rng.pick(types)};`);
  }
  lines.push('}');
  lines.push('');

  // Class
  lines.push(`/**`);
  lines.push(` * ${className} handles ${modulePath.replace(/\//g, ' ')} operations.`);
  lines.push(` * Module index: ${index}`);
  lines.push(` */`);
  lines.push(`export class ${className} {`);

  // Private fields
  lines.push(`  private readonly id: string;`);
  lines.push(`  private data: ${interfaceName}[];`);
  lines.push(`  private initialized: boolean = false;`);
  lines.push('');

  // Constructor
  lines.push(`  constructor(id: string) {`);
  lines.push(`    this.id = id;`);
  lines.push(`    this.data = [];`);
  lines.push(`  }`);
  lines.push('');

  // Methods
  for (let m = 0; m < methodCount; m++) {
    const methodName = rng.camelCase();
    const paramCount = rng.int(0, 3);
    const params: string[] = [];
    for (let p = 0; p < paramCount; p++) {
      params.push(`${rng.identifier(4)}: ${rng.pick(types)}`);
    }
    const returnType = rng.pick([...types, 'void', 'Promise<void>', `${interfaceName}[]`]);

    lines.push(`  ${m === 0 ? 'async ' : ''}${methodName}(${params.join(', ')}): ${m === 0 ? 'Promise<' + returnType + '>' : returnType} {`);

    // Method body - generate some plausible logic
    const bodyLines = rng.int(15, 50);
    for (let b = 0; b < bodyLines; b++) {
      lines.push(`    ${generateStatementLine(rng)}`);
    }

    lines.push(`  }`);
    lines.push('');
  }

  lines.push('}');
  lines.push('');

  // Helper function 1: validate
  lines.push(`function validate${className}(input: unknown): input is ${interfaceName} {`);
  lines.push(`  if (typeof input !== 'object' || input === null) return false;`);
  lines.push(`  const obj = input as Record<string, unknown>;`);
  lines.push(`  return typeof obj['id'] === 'string';`);
  lines.push('}');
  lines.push('');

  // Helper function 2: transform
  lines.push(`function transform${className}(data: ${interfaceName}[]): Record<string, ${interfaceName}> {`);
  lines.push(`  const result: Record<string, ${interfaceName}> = {};`);
  lines.push(`  for (const item of data) {`);
  lines.push(`    if (item && typeof item === 'object') {`);
  lines.push(`      const key = (item as any).id || Math.random().toString(36);`);
  lines.push(`      result[key] = item;`);
  lines.push(`    }`);
  lines.push(`  }`);
  lines.push(`  return result;`);
  lines.push('}');
  lines.push('');

  // Export default
  lines.push(`export default ${className};`);
  lines.push('');

  return lines.join('\n');
}

function generateUtilContent(index: number, rng: SeededRandom): string {
  const lines: string[] = [];
  const funcCount = rng.int(3, 6);

  lines.push(`// Utility module ${index}`);
  lines.push(`// Auto-generated for benchmarking purposes`);
  lines.push('');

  for (let f = 0; f < funcCount; f++) {
    const funcName = rng.camelCase();
    const types = ['string', 'number', 'boolean', 'unknown[]', 'Record<string, string>'];
    const paramType = rng.pick(types);
    const returnType = rng.pick(types);

    lines.push(`/**`);
    lines.push(` * ${funcName} - utility function #${f}`);
    lines.push(` * @param input - the input value`);
    lines.push(` * @returns processed result`);
    lines.push(` */`);
    lines.push(`export function ${funcName}(input: ${paramType}): ${returnType} {`);

    const bodyLines = rng.int(5, 15);
    for (let b = 0; b < bodyLines; b++) {
      lines.push(`  ${generateStatementLine(rng)}`);
    }

    lines.push(`  return ${getDefaultReturn(returnType)};`);
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

function generateModelContent(index: number, rng: SeededRandom): string {
  const lines: string[] = [];
  const modelName = rng.pascalCase() + 'Model';

  lines.push(`// Model ${index}: ${modelName}`);
  lines.push('');

  // Enum
  const enumName = `${modelName}Status`;
  lines.push(`export enum ${enumName} {`);
  const statuses = ['Active', 'Inactive', 'Pending', 'Archived', 'Deleted', 'Suspended'];
  for (const s of statuses.slice(0, rng.int(3, 6))) {
    lines.push(`  ${s} = '${s.toLowerCase()}',`);
  }
  lines.push('}');
  lines.push('');

  // Interface
  lines.push(`export interface ${modelName} {`);
  lines.push(`  id: string;`);
  lines.push(`  createdAt: Date;`);
  lines.push(`  updatedAt: Date;`);
  lines.push(`  status: ${enumName};`);
  const fieldCount = rng.int(5, 15);
  const types = ['string', 'number', 'boolean', 'Date', 'string[]', 'number[]'];
  for (let i = 0; i < fieldCount; i++) {
    lines.push(`  ${rng.camelCase()}: ${rng.pick(types)};`);
  }
  lines.push('}');
  lines.push('');

  // Validation function
  lines.push(`export function validate${modelName}(data: Partial<${modelName}>): string[] {`);
  lines.push(`  const errors: string[] = [];`);
  lines.push(`  if (!data.id) errors.push('id is required');`);
  lines.push(`  if (!data.status) errors.push('status is required');`);
  for (let i = 0; i < rng.int(2, 5); i++) {
    const field = rng.camelCase();
    lines.push(`  if (data.${field} === undefined) errors.push('${field} is required');`);
  }
  lines.push(`  return errors;`);
  lines.push('}');
  lines.push('');

  // Serialization
  lines.push(`export function serialize${modelName}(model: ${modelName}): Record<string, unknown> {`);
  lines.push(`  return {`);
  lines.push(`    ...model,`);
  lines.push(`    createdAt: model.createdAt.toISOString(),`);
  lines.push(`    updatedAt: model.updatedAt.toISOString(),`);
  lines.push(`  };`);
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

function generateTestContent(index: number, rng: SeededRandom): string {
  const lines: string[] = [];
  const testSubject = rng.pascalCase();

  lines.push(`// Test suite ${index}: ${testSubject}`);
  lines.push(`import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';`);
  lines.push('');

  lines.push(`describe('${testSubject}', () => {`);
  lines.push(`  let instance: any;`);
  lines.push('');
  lines.push(`  beforeEach(() => {`);
  lines.push(`    instance = {};`);
  lines.push(`  });`);
  lines.push('');
  lines.push(`  afterEach(() => {`);
  lines.push(`    instance = null;`);
  lines.push(`  });`);
  lines.push('');

  const testCount = rng.int(3, 8);
  for (let t = 0; t < testCount; t++) {
    const testName = `should ${rng.pick(['handle', 'process', 'validate', 'transform', 'return'])} ${rng.camelCase()} correctly`;
    lines.push(`  it('${testName}', () => {`);
    const assertionCount = rng.int(2, 5);
    for (let a = 0; a < assertionCount; a++) {
      lines.push(`    ${generateAssertionLine(rng)}`);
    }
    lines.push(`  });`);
    lines.push('');
  }

  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

function generateStatementLine(rng: SeededRandom): string {
  const statements = [
    `const ${rng.identifier(4)} = this.data.filter(item => item !== null);`,
    `const ${rng.identifier(4)} = Date.now();`,
    `if (!this.initialized) { this.initialized = true; }`,
    `const ${rng.identifier(4)} = JSON.parse(JSON.stringify(this.data));`,
    `const ${rng.identifier(4)} = Math.max(0, this.data.length - 1);`,
    `console.log(\`Processing \${this.id} at \${new Date().toISOString()}\`);`,
    `const ${rng.identifier(4)} = this.data.map(d => ({ ...d }));`,
    `const ${rng.identifier(4)} = Object.keys(this.data).length;`,
    `// TODO: optimize this section for production`,
    `const ${rng.identifier(4)} = Buffer.from(this.id).toString('base64');`,
    `const ${rng.identifier(4)} = this.data.reduce((acc, val) => acc + 1, 0);`,
    `const ${rng.identifier(4)} = new Map<string, unknown>();`,
    `const ${rng.identifier(4)} = Array.from({ length: 10 }, (_, i) => i);`,
    `const ${rng.identifier(4)} = crypto.randomUUID?.() ?? this.id;`,
    `const ${rng.identifier(4)} = this.data.slice(0, 100);`,
  ];
  return rng.pick(statements);
}

function generateAssertionLine(rng: SeededRandom): string {
  const assertions = [
    `expect(instance).toBeDefined();`,
    `expect(typeof instance).toBe('object');`,
    `expect(instance).not.toBeNull();`,
    `expect(Object.keys(instance)).toHaveLength(0);`,
    `expect(() => { throw new Error('test'); }).toThrow();`,
    `expect(true).toBe(true);`,
    `expect(1 + 1).toBe(2);`,
    `expect([1, 2, 3]).toContain(2);`,
    `expect('hello world').toMatch(/hello/);`,
  ];
  return rng.pick(assertions);
}

function getDefaultReturn(type: string): string {
  switch (type) {
    case 'string': return "''";
    case 'number': return '0';
    case 'boolean': return 'false';
    case 'unknown[]': return '[]';
    case 'Record<string, string>': return '{}';
    default: return 'undefined as any';
  }
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}
