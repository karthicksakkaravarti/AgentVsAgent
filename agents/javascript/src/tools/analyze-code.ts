/**
 * Tool: analyze_code
 * Regex-based code analysis for structure extraction.
 * Uses regex (not AST) for fair cross-language benchmarking.
 */

import * as fs from 'fs';
import * as path from 'path';

type AnalysisType = 'imports' | 'exports' | 'functions' | 'classes' | 'errors' | 'dependencies';

export async function analyzeCode(
  args: Record<string, unknown>,
  projectPath: string
): Promise<string> {
  const filePath = args.path as string;
  const analysis = args.analysis as AnalysisType;

  const fullPath = path.resolve(projectPath, filePath);

  if (!fs.existsSync(fullPath)) {
    return `Error: File not found: ${filePath}`;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');

  switch (analysis) {
    case 'imports':
      return analyzeImports(content, filePath);
    case 'exports':
      return analyzeExports(content, filePath);
    case 'functions':
      return analyzeFunctions(content, filePath);
    case 'classes':
      return analyzeClasses(content, filePath);
    case 'errors':
      return analyzeErrors(content, filePath);
    case 'dependencies':
      return analyzeDependencies(content, filePath);
    default:
      return `Error: Unknown analysis type "${analysis}"`;
  }
}

function analyzeImports(content: string, filePath: string): string {
  const results: string[] = [`=== Import Analysis: ${filePath} ===`];

  // ES6 imports
  const es6Regex = /import\s+(?:{([^}]+)}\s+from\s+)?(?:(\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = es6Regex.exec(content)) !== null) {
    const named = match[1]?.trim();
    const defaultImport = match[2];
    const source = match[3];
    if (defaultImport) {
      results.push(`  default: ${defaultImport} from "${source}"`);
    }
    if (named) {
      results.push(`  named: { ${named} } from "${source}"`);
    }
    if (!defaultImport && !named) {
      results.push(`  side-effect: "${source}"`);
    }
  }

  // CommonJS requires
  const cjsRegex = /(?:const|let|var)\s+(?:{([^}]+)}|(\w+))\s*=\s*require\(['"]([^'"]+)['"]\)/g;
  while ((match = cjsRegex.exec(content)) !== null) {
    const destructured = match[1]?.trim();
    const varName = match[2];
    const source = match[3];
    if (destructured) {
      results.push(`  require: { ${destructured} } from "${source}"`);
    } else {
      results.push(`  require: ${varName} from "${source}"`);
    }
  }

  if (results.length === 1) {
    results.push('  No imports found');
  }

  return results.join('\n');
}

function analyzeExports(content: string, filePath: string): string {
  const results: string[] = [`=== Export Analysis: ${filePath} ===`];

  // Named exports
  const namedRegex = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
  let match;
  while ((match = namedRegex.exec(content)) !== null) {
    results.push(`  named: ${match[1]}`);
  }

  // Default export
  const defaultRegex = /export\s+default\s+(?:class|function)?\s*(\w+)?/g;
  while ((match = defaultRegex.exec(content)) !== null) {
    results.push(`  default: ${match[1] ?? '(anonymous)'}`);
  }

  // Re-exports
  const reExportRegex = /export\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = reExportRegex.exec(content)) !== null) {
    results.push(`  re-export: { ${match[1].trim()} } from "${match[2]}"`);
  }

  if (results.length === 1) {
    results.push('  No exports found');
  }

  return results.join('\n');
}

function analyzeFunctions(content: string, filePath: string): string {
  const results: string[] = [`=== Function Analysis: ${filePath} ===`];

  // Regular functions
  const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^\s{]+))?/g;
  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    const params = match[2].trim() || 'none';
    const returnType = match[3] ?? 'untyped';
    results.push(`  function ${match[1]}(${params}): ${returnType}`);
  }

  // Arrow functions assigned to const
  const arrowRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)(?:\s*:\s*([^\s=]+))?\s*=>/g;
  while ((match = arrowRegex.exec(content)) !== null) {
    const params = match[2].trim() || 'none';
    const returnType = match[3] ?? 'untyped';
    results.push(`  arrow ${match[1]}(${params}): ${returnType}`);
  }

  // Class methods (indented function-like patterns)
  const methodRegex = /^\s+(?:async\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^\s{]+))?\s*{/gm;
  while ((match = methodRegex.exec(content)) !== null) {
    if (!['if', 'for', 'while', 'switch', 'catch'].includes(match[1])) {
      const params = match[2].trim() || 'none';
      const returnType = match[3] ?? 'untyped';
      results.push(`  method ${match[1]}(${params}): ${returnType}`);
    }
  }

  if (results.length === 1) {
    results.push('  No functions found');
  }

  return results.join('\n');
}

function analyzeClasses(content: string, filePath: string): string {
  const results: string[] = [`=== Class Analysis: ${filePath} ===`];

  const classRegex = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?\s*{/g;
  let match;
  while ((match = classRegex.exec(content)) !== null) {
    let line = `  class ${match[1]}`;
    if (match[2]) line += ` extends ${match[2]}`;
    if (match[3]) line += ` implements ${match[3].trim()}`;
    results.push(line);

    // Find methods within this class (simple heuristic)
    const classBody = extractBlock(content, classRegex.lastIndex - 1);
    const methodRegex = /(?:public|private|protected|static|async|get|set)?\s*(\w+)\s*\(/g;
    let methodMatch;
    while ((methodMatch = methodRegex.exec(classBody)) !== null) {
      if (!['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(methodMatch[1])) {
        results.push(`    - ${methodMatch[1]}()`);
      }
    }
  }

  if (results.length === 1) {
    results.push('  No classes found');
  }

  return results.join('\n');
}

function analyzeErrors(content: string, filePath: string): string {
  const results: string[] = [`=== Error Handling Analysis: ${filePath} ===`];

  // Try-catch blocks
  const tryCatchRegex = /try\s*{/g;
  let count = 0;
  while (tryCatchRegex.exec(content) !== null) count++;
  results.push(`  try-catch blocks: ${count}`);

  // Throw statements
  const throwRegex = /throw\s+new\s+(\w+)\s*\(/g;
  let match;
  const thrownErrors: string[] = [];
  while ((match = throwRegex.exec(content)) !== null) {
    thrownErrors.push(match[1]);
  }
  results.push(`  throw statements: ${thrownErrors.length}`);
  if (thrownErrors.length > 0) {
    results.push(`  thrown types: ${[...new Set(thrownErrors)].join(', ')}`);
  }

  // .catch() calls
  const catchCallRegex = /\.catch\s*\(/g;
  count = 0;
  while (catchCallRegex.exec(content) !== null) count++;
  results.push(`  .catch() calls: ${count}`);

  return results.join('\n');
}

function analyzeDependencies(content: string, filePath: string): string {
  const results: string[] = [`=== Dependency Analysis: ${filePath} ===`];

  const deps = new Set<string>();

  // ES6 imports
  const es6Regex = /from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = es6Regex.exec(content)) !== null) {
    deps.add(match[1]);
  }

  // require()
  const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    deps.add(match[1]);
  }

  const local = [...deps].filter(d => d.startsWith('.') || d.startsWith('/'));
  const external = [...deps].filter(d => !d.startsWith('.') && !d.startsWith('/'));

  results.push(`  Local dependencies (${local.length}):`);
  local.forEach(d => results.push(`    - ${d}`));

  results.push(`  External dependencies (${external.length}):`);
  external.forEach(d => results.push(`    - ${d}`));

  return results.join('\n');
}

function extractBlock(content: string, startBrace: number): string {
  let depth = 0;
  let i = startBrace;
  for (; i < content.length; i++) {
    if (content[i] === '{') depth++;
    if (content[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return content.substring(startBrace, i + 1);
}
