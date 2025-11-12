#!/usr/bin/env node

/**
 * Extract and aggregate coverage metrics for src/components from vitest text output.
 * Run: node scripts/extract-coverage.js < full-coverage-output.txt
 */

const fs = require('fs');
const path = require('path');

// Read from stdin or file argument
const input = process.argv[2]
  ? fs.readFileSync(process.argv[2], 'utf8')
  : fs.readFileSync(0, 'utf8'); // stdin

// Parse coverage table from vitest text output
// Format: " File                | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s "
const lines = input.split('\n');

let inCoverageTable = false;
const componentFiles = [];
let totalFiles = null;

for (const line of lines) {
  // Detect coverage table start
  if (line.includes('% Stmts') && line.includes('% Branch')) {
    inCoverageTable = true;
    continue;
  }

  // Detect table end
  if (inCoverageTable && line.trim() === '') {
    break;
  }

  if (!inCoverageTable) continue;

  // Parse line: "  src/components/FriendList.tsx  | 100   | 100    | 100   | 100   |"
  const match = line.match(/^\s*(src\/components\/[^\s|]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/);
  
  if (match) {
    const [, file, stmts, branch, funcs, linesVal] = match;
    componentFiles.push({
      file,
      stmts: parseFloat(stmts),
      branch: parseFloat(branch),
      funcs: parseFloat(funcs),
      lines: parseFloat(linesVal),
    });
  }

  // Capture totals line: " All files  | 42.15 | 35.82 | 38.94 | 42.15 |"
  const totalMatch = line.match(/^\s*All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/);
  if (totalMatch) {
    const [, stmts, branch, funcs, linesVal] = totalMatch;
    totalFiles = {
      stmts: parseFloat(stmts),
      branch: parseFloat(branch),
      funcs: parseFloat(funcs),
      lines: parseFloat(linesVal),
    };
  }
}

if (componentFiles.length === 0) {
  console.error('No component coverage data found. Make sure vitest --coverage ran with text reporter.');
  process.exit(1);
}

// Aggregate src/components metrics (simple average - not weighted by file size)
const componentsAvg = {
  stmts: componentFiles.reduce((sum, f) => sum + f.stmts, 0) / componentFiles.length,
  branch: componentFiles.reduce((sum, f) => sum + f.branch, 0) / componentFiles.length,
  funcs: componentFiles.reduce((sum, f) => sum + f.funcs, 0) / componentFiles.length,
  lines: componentFiles.reduce((sum, f) => sum + f.lines, 0) / componentFiles.length,
};

console.log('\n=== src/components Coverage Summary ===\n');
console.log(`Files analyzed: ${componentFiles.length}`);
console.log(`Statements: ${componentsAvg.stmts.toFixed(2)}%`);
console.log(`Branches:   ${componentsAvg.branch.toFixed(2)}%`);
console.log(`Functions:  ${componentsAvg.funcs.toFixed(2)}%`);
console.log(`Lines:      ${componentsAvg.lines.toFixed(2)}%`);

const gapTo50 = 50 - componentsAvg.lines;
console.log(`\nGap to 50% target: ${gapTo50.toFixed(2)}%`);

if (totalFiles) {
  console.log('\n=== Overall Project Coverage ===\n');
  console.log(`Statements: ${totalFiles.stmts.toFixed(2)}%`);
  console.log(`Branches:   ${totalFiles.branch.toFixed(2)}%`);
  console.log(`Functions:  ${totalFiles.funcs.toFixed(2)}%`);
  console.log(`Lines:      ${totalFiles.lines.toFixed(2)}%`);
}

console.log('\n');
