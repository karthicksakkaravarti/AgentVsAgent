#!/usr/bin/env node
/**
 * Generates the full 73-step golden transcript covering all 15 bugs.
 * Reads actual files from the generated project, applies fixes, and builds transcript.json.
 */

const fs = require('fs');
const path = require('path');

const GENERATED = path.join(__dirname, '..', 'target-project', 'generated');
const OUTPUT = path.join(__dirname, 'transcript.json');

function readFile(relPath) {
  return fs.readFileSync(path.join(GENERATED, relPath), 'utf-8');
}

function fixedContent(relPath, buggyPattern, fixedPattern) {
  const content = readFile(relPath);
  if (!content.includes(buggyPattern)) {
    console.error(`WARNING: buggy pattern not found in ${relPath}: "${buggyPattern.substring(0, 60)}..."`);
  }
  return content.replace(buggyPattern, fixedPattern);
}

function step(num, desc, toolName, args, finishReason = 'tool_calls', textContent = null) {
  const id = `chatcmpl-mock-${String(num).padStart(3, '0')}`;
  const callId = `call_${String(num).padStart(3, '0')}_${toolName}`;

  if (finishReason === 'stop') {
    return {
      stepNumber: num,
      description: desc,
      response: {
        id,
        object: 'chat.completion',
        created: 1700000000 + num,
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: textContent
          },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 1500 + num * 200, completion_tokens: 200, total_tokens: 1700 + num * 200 }
      }
    };
  }

  return {
    stepNumber: num,
    description: desc,
    response: {
      id,
      object: 'chat.completion',
      created: 1700000000 + num,
      model: 'gpt-4',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: callId,
            type: 'function',
            function: {
              name: toolName,
              arguments: JSON.stringify(args)
            }
          }]
        },
        finish_reason: 'tool_calls'
      }],
      usage: { prompt_tokens: 500 + num * 100, completion_tokens: 80 + num * 5, total_tokens: 580 + num * 105 }
    }
  };
}

// Build all 73 steps
const steps = [];

// ============================================================
// Phase 1: Initial Reconnaissance (Steps 1-5)
// ============================================================
steps.push(step(1, 'Read error log to discover bug patterns', 'read_file', {
  path: 'logs/error.log', startLine: 1, endLine: 100
}));

steps.push(step(2, 'Read more error log entries', 'read_file', {
  path: 'logs/error.log', startLine: 100, endLine: 200
}));

steps.push(step(3, 'List project module structure', 'list_directory', {
  path: 'src/modules', recursive: true, maxDepth: 1
}));

steps.push(step(4, 'List config directory structure', 'list_directory', {
  path: 'config/environments', recursive: true, maxDepth: 2
}));

steps.push(step(5, 'Search error log for consolidated ERROR entries', 'search_files', {
  pattern: 'ERROR', path: 'logs/error.log', maxResults: 50
}));

// ============================================================
// Phase 2: Type Errors — Bugs 1-3 (Steps 6-17)
// ============================================================

// Bug 1: src/modules/analytics/rpjhlr-339.ts line 28
steps.push(step(6, 'Search for parseFloat/NaN patterns in source', 'search_files', {
  pattern: 'parseFloat|NaN', path: 'src/', include: '*.ts', maxResults: 20
}));

steps.push(step(7, 'Read type error bug 1 in analytics module', 'read_file', {
  path: 'src/modules/analytics/rpjhlr-339.ts', startLine: 20, endLine: 40
}));

steps.push(step(8, 'Analyze code structure of buggy analytics file', 'analyze_code', {
  path: 'src/modules/analytics/rpjhlr-339.ts', analysis: 'functions'
}));

const fix1 = fixedContent(
  'src/modules/analytics/rpjhlr-339.ts',
  '    const total = parseFloat(String(amount)) + tax;',
  '    const total = amount + tax;'
);
steps.push(step(9, 'Fix type error bug 1: remove parseFloat(String()) wrapper', 'write_file', {
  path: 'src/modules/analytics/rpjhlr-339.ts',
  content: fix1
}));

// Bug 2: src/modules/reporting/htspwx-394.ts line 31
steps.push(step(10, 'Read type error bug 2 in reporting module', 'read_file', {
  path: 'src/modules/reporting/htspwx-394.ts', startLine: 24, endLine: 40
}));

steps.push(step(11, 'Analyze code structure of buggy reporting file', 'analyze_code', {
  path: 'src/modules/reporting/htspwx-394.ts', analysis: 'functions'
}));

const fix2 = fixedContent(
  'src/modules/reporting/htspwx-394.ts',
  '    const total = parseFloat(String(amount)) + tax;',
  '    const total = amount + tax;'
);
steps.push(step(12, 'Fix type error bug 2: remove parseFloat(String()) wrapper', 'write_file', {
  path: 'src/modules/reporting/htspwx-394.ts',
  content: fix2
}));

// Bug 3: src/modules/reporting/mooicv-41.ts line 34
steps.push(step(13, 'Read type error bug 3 in reporting module', 'read_file', {
  path: 'src/modules/reporting/mooicv-41.ts', startLine: 27, endLine: 42
}));

const fix3 = fixedContent(
  'src/modules/reporting/mooicv-41.ts',
  '    const total = parseFloat(String(amount)) + tax;',
  '    const total = amount + tax;'
);
steps.push(step(14, 'Fix type error bug 3: remove parseFloat(String()) wrapper', 'write_file', {
  path: 'src/modules/reporting/mooicv-41.ts',
  content: fix3
}));

// Verification
steps.push(step(15, 'Verify: search for remaining parseFloat(String patterns', 'search_files', {
  pattern: 'parseFloat\\(String', path: 'src/', include: '*.ts', maxResults: 10
}));

steps.push(step(16, 'Re-read analytics file to confirm fix', 'read_file', {
  path: 'src/modules/analytics/rpjhlr-339.ts', startLine: 25, endLine: 30
}));

steps.push(step(17, 'Re-read reporting file to confirm fix', 'read_file', {
  path: 'src/modules/reporting/htspwx-394.ts', startLine: 28, endLine: 33
}));

// ============================================================
// Phase 3: Null References — Bugs 4-6 (Steps 18-29)
// ============================================================

steps.push(step(18, 'Search error log for null reference errors', 'search_files', {
  pattern: 'Cannot read properties of null', path: 'logs/', maxResults: 20
}));

steps.push(step(19, 'Search for unsafe config access pattern', 'search_files', {
  pattern: 'config\\.settings\\.database\\.host', path: 'src/', include: '*.ts', maxResults: 10
}));

// Bug 4: src/modules/integrations/gcp/zxwlpa-7.ts line 22
steps.push(step(20, 'Read null reference bug 4 in GCP integration', 'read_file', {
  path: 'src/modules/integrations/gcp/zxwlpa-7.ts', startLine: 15, endLine: 35
}));

const fix4 = fixedContent(
  'src/modules/integrations/gcp/zxwlpa-7.ts',
  '    const value = config.settings.database.host.toUpperCase();',
  "    const value = config?.settings?.database?.host?.toUpperCase() ?? 'LOCALHOST';"
);
steps.push(step(21, 'Fix null reference bug 4: add optional chaining', 'write_file', {
  path: 'src/modules/integrations/gcp/zxwlpa-7.ts',
  content: fix4
}));

// Bug 5: src/modules/integrations/github/tqkihc-6.ts line 27
steps.push(step(22, 'Read null reference bug 5 in GitHub integration', 'read_file', {
  path: 'src/modules/integrations/github/tqkihc-6.ts', startLine: 20, endLine: 35
}));

const fix5 = fixedContent(
  'src/modules/integrations/github/tqkihc-6.ts',
  '    const value = config.settings.database.host.toUpperCase();',
  "    const value = config?.settings?.database?.host?.toUpperCase() ?? 'LOCALHOST';"
);
steps.push(step(23, 'Fix null reference bug 5: add optional chaining', 'write_file', {
  path: 'src/modules/integrations/github/tqkihc-6.ts',
  content: fix5
}));

// Bug 6: src/modules/reporting/oyhchg-328.ts line 32
steps.push(step(24, 'Read null reference bug 6 in reporting module', 'read_file', {
  path: 'src/modules/reporting/oyhchg-328.ts', startLine: 25, endLine: 40
}));

const fix6 = fixedContent(
  'src/modules/reporting/oyhchg-328.ts',
  '    const value = config.settings.database.host.toUpperCase();',
  "    const value = config?.settings?.database?.host?.toUpperCase() ?? 'LOCALHOST';"
);
steps.push(step(25, 'Fix null reference bug 6: add optional chaining', 'write_file', {
  path: 'src/modules/reporting/oyhchg-328.ts',
  content: fix6
}));

// Verification
steps.push(step(26, 'Verify: search for remaining unsafe config access', 'search_files', {
  pattern: 'config\\.settings\\.database\\.host\\.toUpperCase', path: 'src/', include: '*.ts', maxResults: 10
}));

steps.push(step(27, 'Re-read GCP integration file to confirm fix', 'read_file', {
  path: 'src/modules/integrations/gcp/zxwlpa-7.ts', startLine: 19, endLine: 25
}));

steps.push(step(28, 'Re-read GitHub integration file to confirm fix', 'read_file', {
  path: 'src/modules/integrations/github/tqkihc-6.ts', startLine: 24, endLine: 30
}));

steps.push(step(29, 'Re-read reporting file to confirm fix', 'read_file', {
  path: 'src/modules/reporting/oyhchg-328.ts', startLine: 29, endLine: 35
}));

// ============================================================
// Phase 4: Off-by-One Errors — Bugs 7-9 (Steps 30-41)
// ============================================================

steps.push(step(30, 'Search for off-by-one loop patterns', 'search_files', {
  pattern: '<= items\\.length', path: 'src/', include: '*.ts', maxResults: 10
}));

// Bug 7: src/modules/shipping/scpexr-366.ts line 20
steps.push(step(31, 'Read off-by-one bug 7 in shipping module', 'read_file', {
  path: 'src/modules/shipping/scpexr-366.ts', startLine: 13, endLine: 30
}));

const fix7 = fixedContent(
  'src/modules/shipping/scpexr-366.ts',
  '    for (let i = 0; i <= items.length; i++) {',
  '    for (let i = 0; i < items.length; i++) {'
);
steps.push(step(32, 'Fix off-by-one bug 7: change <= to <', 'write_file', {
  path: 'src/modules/shipping/scpexr-366.ts',
  content: fix7
}));

// Bug 8: src/modules/inventory/xdqcha-338.ts line 24
steps.push(step(33, 'Read off-by-one bug 8 in inventory module', 'read_file', {
  path: 'src/modules/inventory/xdqcha-338.ts', startLine: 17, endLine: 32
}));

const fix8 = fixedContent(
  'src/modules/inventory/xdqcha-338.ts',
  '    for (let i = 0; i <= items.length; i++) {',
  '    for (let i = 0; i < items.length; i++) {'
);
steps.push(step(34, 'Fix off-by-one bug 8: change <= to <', 'write_file', {
  path: 'src/modules/inventory/xdqcha-338.ts',
  content: fix8
}));

// Bug 9: src/modules/integrations/azure/iikhgd-17.ts line 28
steps.push(step(35, 'Read off-by-one bug 9 in Azure integration', 'read_file', {
  path: 'src/modules/integrations/azure/iikhgd-17.ts', startLine: 21, endLine: 36
}));

const fix9 = fixedContent(
  'src/modules/integrations/azure/iikhgd-17.ts',
  '    for (let i = 0; i <= items.length; i++) {',
  '    for (let i = 0; i < items.length; i++) {'
);
steps.push(step(36, 'Fix off-by-one bug 9: change <= to <', 'write_file', {
  path: 'src/modules/integrations/azure/iikhgd-17.ts',
  content: fix9
}));

// Verification
steps.push(step(37, 'Verify: search for remaining <= items.length patterns', 'search_files', {
  pattern: '<= items\\.length', path: 'src/', include: '*.ts', maxResults: 10
}));

steps.push(step(38, 'Re-read shipping file to confirm fix', 'read_file', {
  path: 'src/modules/shipping/scpexr-366.ts', startLine: 18, endLine: 24
}));

steps.push(step(39, 'Re-read inventory file to confirm fix', 'read_file', {
  path: 'src/modules/inventory/xdqcha-338.ts', startLine: 22, endLine: 28
}));

steps.push(step(40, 'Re-read Azure integration file to confirm fix', 'read_file', {
  path: 'src/modules/integrations/azure/iikhgd-17.ts', startLine: 26, endLine: 32
}));

steps.push(step(41, 'Search error log for array index out of bounds errors', 'search_files', {
  pattern: 'Array index out of bounds', path: 'logs/', maxResults: 10
}));

// ============================================================
// Phase 5: Config Errors — Bugs 10-12 (Steps 42-56)
// ============================================================

steps.push(step(42, 'Search error log for configuration errors', 'search_files', {
  pattern: 'Invalid configuration', path: 'logs/', maxResults: 10
}));

steps.push(step(43, 'List production config files', 'list_directory', {
  path: 'config/environments/production', recursive: false
}));

// Bug 10: database.json — "max": 0 → "max": 50
steps.push(step(44, 'Read database config to find pool max bug', 'read_file', {
  path: 'config/environments/production/database.json', startLine: 1, endLine: 30
}));

steps.push(step(45, 'Analyze database config structure', 'analyze_code', {
  path: 'config/environments/production/database.json', analysis: 'dependencies'
}));

const dbConfig = readFile('config/environments/production/database.json');
const dbConfigFixed = dbConfig.replace('"max": 0', '"max": 50');
steps.push(step(46, 'Fix config bug 10: set database pool max to 50', 'write_file', {
  path: 'config/environments/production/database.json',
  content: dbConfigFixed
}));

// Bug 11: cache.json — "retryDelayMs": -1 → "retryDelayMs": 100
steps.push(step(47, 'Read cache config to find retry delay bug', 'read_file', {
  path: 'config/environments/production/cache.json', startLine: 1, endLine: 30
}));

steps.push(step(48, 'Read full cache config to understand structure', 'read_file', {
  path: 'config/environments/production/cache.json'
}));

const cacheConfig = readFile('config/environments/production/cache.json');
const cacheConfigFixed = cacheConfig.replace('"retryDelayMs": -1', '"retryDelayMs": 100');
steps.push(step(49, 'Fix config bug 11: set redis retryDelayMs to 100', 'write_file', {
  path: 'config/environments/production/cache.json',
  content: cacheConfigFixed
}));

// Bug 12: api-gateway.json — "maxAge": -86400 → "maxAge": 86400
steps.push(step(50, 'Read api-gateway config to find CORS maxAge bug', 'read_file', {
  path: 'config/environments/production/api-gateway.json', startLine: 1, endLine: 40
}));

steps.push(step(51, 'Read api-gateway config around maxAge area', 'read_file', {
  path: 'config/environments/production/api-gateway.json', startLine: 25, endLine: 45
}));

const gwConfig = readFile('config/environments/production/api-gateway.json');
const gwConfigFixed = gwConfig.replace('"maxAge": -86400', '"maxAge": 86400');
steps.push(step(52, 'Fix config bug 12: set CORS maxAge to positive value', 'write_file', {
  path: 'config/environments/production/api-gateway.json',
  content: gwConfigFixed
}));

// Verification
steps.push(step(53, 'Re-read database config to confirm pool max fix', 'read_file', {
  path: 'config/environments/production/database.json', startLine: 5, endLine: 10
}));

steps.push(step(54, 'Re-read cache config to confirm retryDelayMs fix', 'read_file', {
  path: 'config/environments/production/cache.json', startLine: 8, endLine: 14
}));

steps.push(step(55, 'Re-read api-gateway config to confirm maxAge fix', 'read_file', {
  path: 'config/environments/production/api-gateway.json', startLine: 28, endLine: 35
}));

steps.push(step(56, 'Verify no invalid config values remain', 'execute_command', {
  command: 'grep -c \'"max": 0\\|"retryDelayMs": -1\\|"maxAge": -\' config/environments/production/*.json || echo "All config values fixed"',
  timeout: 5000
}));

// ============================================================
// Phase 6: Logic Errors — Bugs 13-15 (Steps 57-68)
// ============================================================

steps.push(step(57, 'Search error log for authorization bypass', 'search_files', {
  pattern: 'Unauthorized access|role check bypassed', path: 'logs/', maxResults: 10
}));

steps.push(step(58, 'Search for incorrect OR in negated condition', 'search_files', {
  pattern: "!== 'admin' \\|\\|", path: 'src/', include: '*.ts', maxResults: 10
}));

// Bug 13: src/modules/billing/nxpita-32.ts line 24 (|| → &&)
steps.push(step(59, 'Read logic error bug 13 in billing module', 'read_file', {
  path: 'src/modules/billing/nxpita-32.ts', startLine: 17, endLine: 32
}));

const fix13 = fixedContent(
  'src/modules/billing/nxpita-32.ts',
  "    if (userRole !== 'admin' || userRole !== 'superadmin') {",
  "    if (userRole !== 'admin' && userRole !== 'superadmin') {"
);
steps.push(step(60, 'Fix logic error bug 13: change || to && in admin check', 'write_file', {
  path: 'src/modules/billing/nxpita-32.ts',
  content: fix13
}));

// Bug 14: src/modules/reporting/hftjvf-119.ts line 28 (swap 0.1 and 0.2)
steps.push(step(61, 'Search for discount calculation mismatch in logs', 'search_files', {
  pattern: 'Discount calculation mismatch', path: 'logs/', maxResults: 10
}));

steps.push(step(62, 'Read logic error bug 14 in reporting module', 'read_file', {
  path: 'src/modules/reporting/hftjvf-119.ts', startLine: 21, endLine: 36
}));

const fix14 = fixedContent(
  'src/modules/reporting/hftjvf-119.ts',
  '    const discount = price * quantity > 100 ? 0.1 : 0.2;',
  '    const discount = price * quantity > 100 ? 0.2 : 0.1;'
);
steps.push(step(63, 'Fix logic error bug 14: swap discount tier values', 'write_file', {
  path: 'src/modules/reporting/hftjvf-119.ts',
  content: fix14
}));

// Bug 15: src/modules/shipping/vvfmac-51.ts line 30 (> → <)
steps.push(step(64, 'Search for expiry date comparison errors in logs', 'search_files', {
  pattern: 'expired.*still active|marked as expired', path: 'logs/', maxResults: 10
}));

steps.push(step(65, 'Read logic error bug 15 in shipping module', 'read_file', {
  path: 'src/modules/shipping/vvfmac-51.ts', startLine: 23, endLine: 38
}));

const fix15 = fixedContent(
  'src/modules/shipping/vvfmac-51.ts',
  '    const isExpired = expiryDate > new Date();',
  '    const isExpired = expiryDate < new Date();'
);
steps.push(step(66, 'Fix logic error bug 15: fix date comparison operator', 'write_file', {
  path: 'src/modules/shipping/vvfmac-51.ts',
  content: fix15
}));

// Verification
steps.push(step(67, 'Verify: search for remaining incorrect OR in admin check', 'search_files', {
  pattern: "!== 'admin' \\|\\|", path: 'src/', include: '*.ts', maxResults: 10
}));

steps.push(step(68, 'Re-read billing file to confirm fix', 'read_file', {
  path: 'src/modules/billing/nxpita-32.ts', startLine: 22, endLine: 28
}));

// ============================================================
// Phase 7: Final Verification & Summary (Steps 69-73)
// ============================================================

steps.push(step(69, 'Verify project integrity', 'execute_command', {
  command: 'find src/ -name "*.ts" | wc -l',
  timeout: 10000
}));

steps.push(step(70, 'Final sweep: check for parseFloat(String patterns', 'search_files', {
  pattern: 'parseFloat\\(String', path: 'src/', include: '*.ts', maxResults: 10
}));

steps.push(step(71, 'Final sweep: check for <= items.length patterns', 'search_files', {
  pattern: '<= items\\.length', path: 'src/', include: '*.ts', maxResults: 10
}));

steps.push(step(72, 'Final sweep: check for unsafe config access patterns', 'search_files', {
  pattern: 'config\\.settings\\.database\\.host\\.toUpperCase', path: 'src/', include: '*.ts', maxResults: 10
}));

// Step 73: Final summary (stop, no tool call)
steps.push(step(73, 'Final summary of all bug fixes', null, null, 'stop',
  'I have successfully found and fixed all 15 bugs across 5 categories:\n\n' +
  '**Type Errors (3 bugs fixed):**\n' +
  '1. src/modules/analytics/rpjhlr-339.ts - Removed unnecessary parseFloat(String()) coercion\n' +
  '2. src/modules/reporting/htspwx-394.ts - Removed unnecessary parseFloat(String()) coercion\n' +
  '3. src/modules/reporting/mooicv-41.ts - Removed unnecessary parseFloat(String()) coercion\n\n' +
  '**Null Reference Errors (3 bugs fixed):**\n' +
  '4. src/modules/integrations/gcp/zxwlpa-7.ts - Added optional chaining for config access\n' +
  '5. src/modules/integrations/github/tqkihc-6.ts - Added optional chaining for config access\n' +
  '6. src/modules/reporting/oyhchg-328.ts - Added optional chaining for config access\n\n' +
  '**Off-by-One Errors (3 bugs fixed):**\n' +
  '7. src/modules/shipping/scpexr-366.ts - Changed <= to < in loop condition\n' +
  '8. src/modules/inventory/xdqcha-338.ts - Changed <= to < in loop condition\n' +
  '9. src/modules/integrations/azure/iikhgd-17.ts - Changed <= to < in loop condition\n\n' +
  '**Config Errors (3 bugs fixed):**\n' +
  '10. config/environments/production/database.json - Set pool max from 0 to 50\n' +
  '11. config/environments/production/cache.json - Set retryDelayMs from -1 to 100\n' +
  '12. config/environments/production/api-gateway.json - Set maxAge from -86400 to 86400\n\n' +
  '**Logic Errors (3 bugs fixed):**\n' +
  '13. src/modules/billing/nxpita-32.ts - Changed || to && in negated admin check\n' +
  '14. src/modules/reporting/hftjvf-119.ts - Swapped inverted discount tier values\n' +
  '15. src/modules/shipping/vvfmac-51.ts - Fixed inverted date comparison operator\n\n' +
  'All 15 bugs have been verified as fixed through search sweeps confirming no buggy patterns remain.'
));

// Build the transcript
const transcript = {
  version: '1.0.0',
  description: 'Full golden transcript — 73 steps covering all 15 bug fixes across 5 categories',
  targetProject: {
    seed: 42,
    totalBugs: 15
  },
  systemPrompt: 'You are a senior developer. Find and fix all bugs in the project at {PROJECT_PATH}.',
  userPrompt: 'The project at {PROJECT_PATH} has several bugs causing production errors. Find and fix all of them. Start by examining the error logs.',
  steps
};

fs.writeFileSync(OUTPUT, JSON.stringify(transcript, null, 2));

// Verify
const written = JSON.parse(fs.readFileSync(OUTPUT, 'utf-8'));
console.log(`✓ Generated transcript with ${written.steps.length} steps`);
console.log(`✓ File size: ${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB`);
console.log(`✓ Step numbers: ${written.steps[0].stepNumber} to ${written.steps[written.steps.length - 1].stepNumber}`);

// Check all step numbers are sequential
for (let i = 0; i < written.steps.length; i++) {
  if (written.steps[i].stepNumber !== i + 1) {
    console.error(`✗ Step number mismatch at index ${i}: expected ${i + 1}, got ${written.steps[i].stepNumber}`);
  }
}

// Check all tool_call IDs are unique
const ids = written.steps
  .filter(s => s.response.choices[0].message.tool_calls)
  .map(s => s.response.choices[0].message.tool_calls[0].id);
const uniqueIds = new Set(ids);
if (ids.length === uniqueIds.size) {
  console.log(`✓ All ${ids.length} tool_call IDs are unique`);
} else {
  console.error(`✗ Duplicate tool_call IDs found: ${ids.length} total, ${uniqueIds.size} unique`);
}

// Count tool usage
const toolCounts = {};
written.steps.forEach(s => {
  const tc = s.response.choices[0].message.tool_calls;
  if (tc) {
    const name = tc[0].function.name;
    toolCounts[name] = (toolCounts[name] || 0) + 1;
  }
});
console.log('\nTool usage:');
Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
  console.log(`  ${name}: ${count}`);
});
console.log(`  (stop): 1`);
