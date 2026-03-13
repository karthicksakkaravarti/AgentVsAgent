#!/usr/bin/env node
/**
 * Generates the golden transcript covering all bugs from manifest.json.
 * Supports parallel tool_calls per step for I/O-heavy benchmarks.
 */

const fs = require('fs');
const path = require('path');

const GENERATED = path.join(__dirname, '..', 'target-project', 'generated');
const MANIFEST = path.join(__dirname, '..', 'target-project', 'manifest.json');
const OUTPUT = path.join(__dirname, 'transcript.json');

function readFile(relPath) {
  return fs.readFileSync(path.join(GENERATED, relPath), 'utf-8');
}

/**
 * Creates a step with multiple tool_calls (parallel execution)
 * @param {number} num - Step number
 * @param {string} desc - Step description
 * @param {Array<{name: string, args: object}>} tools - Array of tool calls
 * @param {string} [finishReason='tool_calls'] - 'tool_calls' or 'stop'
 * @param {string|null} [textContent=null] - Content for stop steps
 */
function step(num, desc, tools, finishReason = 'tool_calls', textContent = null) {
  const id = `chatcmpl-mock-${String(num).padStart(3, '0')}`;

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

  // Build tool_calls with letter suffixes for parallel calls
  const toolCalls = tools.map((tool, idx) => {
    const suffix = String.fromCharCode(97 + idx); // a, b, c, ...
    return {
      id: `call_${String(num).padStart(3, '0')}${suffix}`,
      type: 'function',
      function: {
        name: tool.name,
        arguments: JSON.stringify(tool.args)
      }
    };
  });

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
          tool_calls: toolCalls
        },
        finish_reason: 'tool_calls'
      }],
      usage: { prompt_tokens: 500 + num * 100, completion_tokens: 80 + num * 5, total_tokens: 580 + num * 105 }
    }
  };
}

function generateSummary(manifest) {
  const bugsByCategory = {};
  for (const bug of manifest.bugs) {
    if (!bugsByCategory[bug.category]) {
      bugsByCategory[bug.category] = [];
    }
    bugsByCategory[bug.category].push(bug);
  }

  let summary = `I have successfully found and fixed all ${manifest.totalBugs} bugs across ${Object.keys(bugsByCategory).length} categories:\n\n`;

  const categoryNames = {
    type_error: 'Type Errors',
    null_reference: 'Null Reference Errors',
    off_by_one: 'Off-by-One Errors',
    config_error: 'Config Errors',
    logic_error: 'Logic Errors'
  };

  for (const [category, bugs] of Object.entries(bugsByCategory)) {
    const name = categoryNames[category] || category;
    summary += `**${name} (${bugs.length} bugs fixed):**\n`;
    for (let i = 0; i < bugs.length; i++) {
      const bug = bugs[i];
      summary += `${i + 1}. ${bug.file} - ${bug.fixedCode}\n`;
    }
    summary += '\n';
  }

  summary += `All ${manifest.totalBugs} bugs have been verified as fixed through search sweeps confirming no buggy patterns remain.`;
  return summary;
}

function main() {
  // Read manifest
  const manifestPath = MANIFEST;
  if (!fs.existsSync(manifestPath)) {
    console.error('ERROR: manifest.json not found. Run npm run generate first.');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log(`Loaded manifest: ${manifest.totalBugs} bugs, seed ${manifest.seed}`);

  const steps = [];
  let stepNum = 1;

  // ============================================================
  // Phase 1: Initial Reconnaissance (1 step, 3 parallel calls)
  // ============================================================
  steps.push(step(stepNum++, 'Initial reconnaissance: read logs and list directories', [
    { name: 'read_file', args: { path: 'logs/error.log', startLine: 1, endLine: 100 } },
    { name: 'list_directory', args: { path: 'src/modules', recursive: false } },
    { name: 'list_directory', args: { path: 'config/environments', recursive: true, maxDepth: 2 } }
  ]));

  // ============================================================
  // Phase 2-N: Process each category with paired reads/writes
  // ============================================================
  const categories = ['type_error', 'null_reference', 'off_by_one', 'config_error', 'logic_error'];
  const categoryNames = {
    type_error: 'Type Errors',
    null_reference: 'Null Reference Errors',
    off_by_one: 'Off-by-One Errors',
    config_error: 'Config Errors',
    logic_error: 'Logic Errors'
  };

  const searchPatterns = {
    type_error: 'parseFloat|NaN',
    null_reference: 'Cannot read properties of null',
    off_by_one: 'Array index out of bounds|<= items.length',
    config_error: 'Invalid configuration',
    logic_error: 'Authorization bypass|Logic error'
  };

  for (const category of categories) {
    const categoryBugs = manifest.bugs.filter(b => b.category === category);
    const bugCount = categoryBugs.length;

    if (bugCount === 0) continue;

    // Search for bug patterns (2 parallel calls)
    steps.push(step(stepNum++, `Search for ${categoryNames[category]} patterns`, [
      { name: 'search_files', args: { pattern: searchPatterns[category], path: 'logs/', maxResults: 20 } },
      { name: 'search_files', args: { pattern: searchPatterns[category], path: 'src/', include: '*.ts', maxResults: 20 } }
    ]));

    // Process bugs in pairs (read both, then write both)
    for (let i = 0; i < bugCount; i += 2) {
      const bug1 = categoryBugs[i];
      const bug2 = categoryBugs[i + 1]; // undefined if odd number

      // Read both buggy files in parallel
      const readTools = [
        { name: 'read_file', args: { path: bug1.file, startLine: 1, endLine: 50 } }
      ];
      if (bug2) {
        readTools.push({ name: 'read_file', args: { path: bug2.file, startLine: 1, endLine: 50 } });
      }
      steps.push(step(stepNum++, `Read ${categoryNames[category]} bugs ${i + 1}${bug2 ? '-' + (i + 2) : ''}`, readTools));

      // Analyze first 3 pairs per category
      if (i < 6) {
        const analyzeTools = [];
        analyzeTools.push({ name: 'analyze_code', args: { path: bug1.file, analysis: 'functions' } });
        if (bug2) {
          analyzeTools.push({ name: 'analyze_code', args: { path: bug2.file, analysis: 'functions' } });
        }
        steps.push(step(stepNum++, `Analyze code structure of buggy files`, analyzeTools));
      }

      // Write fixes for both files in parallel
      const writeTools = [];
      const fixed1 = readFile(bug1.file).replace(bug1.buggyCode, bug1.fixedCode);
      writeTools.push({ name: 'write_file', args: { path: bug1.file, content: fixed1 } });

      if (bug2) {
        const fixed2 = readFile(bug2.file).replace(bug2.buggyCode, bug2.fixedCode);
        writeTools.push({ name: 'write_file', args: { path: bug2.file, content: fixed2 } });
      }
      steps.push(step(stepNum++, `Fix ${categoryNames[category]} bugs ${i + 1}${bug2 ? '-' + (i + 2) : ''}`, writeTools));
    }

    // Verification for this category (2 parallel calls)
    steps.push(step(stepNum++, `Verify no remaining ${categoryNames[category]} patterns`, [
      { name: 'search_files', args: { pattern: searchPatterns[category], path: 'src/', include: '*.ts', maxResults: 10 } },
      { name: 'read_file', args: { path: categoryBugs[0].file, startLine: 1, endLine: 10 } }
    ]));
  }

  // ============================================================
  // Final step: Summary (stop)
  // ============================================================
  const summary = generateSummary(manifest);
  steps.push(step(stepNum, 'Final summary of all bug fixes', [], 'stop', summary));

  // Build the transcript
  const transcript = {
    version: '1.0.0',
    description: `Golden transcript — ${steps.length} steps with ~${categories.length * 4 + Math.ceil(manifest.totalBugs / 2) * 3 + 3} parallel tool_calls covering all ${manifest.totalBugs} bug fixes across ${categories.length} categories`,
    targetProject: {
      seed: manifest.seed,
      totalBugs: manifest.totalBugs
    },
    systemPrompt: 'You are a senior developer. Find and fix all bugs in the project at {PROJECT_PATH}.',
    userPrompt: 'The project at {PROJECT_PATH} has several bugs causing production errors. Find and fix all of them. Start by examining the error logs.',
    steps
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(transcript, null, 2));

  // Verify
  const written = JSON.parse(fs.readFileSync(OUTPUT, 'utf-8'));

  // Count tool_calls
  let toolCallCount = 0;
  written.steps.forEach(s => {
    if (s.response.choices[0].message.tool_calls) {
      toolCallCount += s.response.choices[0].message.tool_calls.length;
    }
    if (s.response.choices[0].finish_reason === 'stop') {
      toolCallCount += 1; // count stop steps as 1
    }
  });

  console.log(`✓ Generated transcript with ${written.steps.length} steps`);
  console.log(`✓ Total tool_calls: ${toolCallCount}`);
  console.log(`✓ File size: ${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB`);
  console.log(`✓ Step numbers: ${written.steps[0].stepNumber} to ${written.steps[written.steps.length - 1].stepNumber}`);

  // Check all step numbers are sequential
  for (let i = 0; i < written.steps.length; i++) {
    if (written.steps[i].stepNumber !== i + 1) {
      console.error(`✗ Step number mismatch at index ${i}: expected ${i + 1}, got ${written.steps[i].stepNumber}`);
    }
  }

  // Check all tool_call IDs are unique
  const ids = [];
  written.steps.forEach(s => {
    const tc = s.response.choices[0].message.tool_calls;
    if (tc) {
      tc.forEach(t => ids.push(t.id));
    }
  });
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
      tc.forEach(t => {
        toolCounts[t.function.name] = (toolCounts[t.function.name] || 0) + 1;
      });
    }
  });
  console.log('\nTool usage:');
  Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
    console.log(`  ${name}: ${count}`);
  });
}

main();
