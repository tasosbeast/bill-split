#!/usr/bin/env node
/**
 * Parse V8 coverage JSON and calculate src/components coverage
 */

const fs = require("fs");
const path = require("path");

// Read coverage JSON
const coverageFile = process.argv[2] || "coverage-report.json";
let coverageData;

try {
  const rawData = fs.readFileSync(coverageFile, "utf8");
  coverageData = JSON.parse(rawData);
} catch (error) {
  console.error(`Error reading coverage file: ${error.message}`);
  process.exit(1);
}

// Extract file coverage metrics
const componentFiles = [];
let totalStatements = 0;
let coveredStatements = 0;
let totalBranches = 0;
let coveredBranches = 0;
let totalFunctions = 0;
let coveredFunctions = 0;
let totalLines = 0;
let coveredLines = 0;

// Process each file in coverage data
for (const [filePath, fileData] of Object.entries(coverageData)) {
  // Normalize path separators
  const normalizedPath = filePath.replace(/\\/g, "/");

  // Check if this is a src/components file (exclude __tests__)
  if (
    normalizedPath.includes("/src/components/") &&
    !normalizedPath.includes("/__tests__/") &&
    !normalizedPath.includes(".test.")
  ) {
    // Extract metrics from V8 coverage format
    const statements = fileData.statementMap
      ? Object.keys(fileData.statementMap).length
      : 0;
    const coveredStmts = fileData.s
      ? Object.values(fileData.s).filter((v) => v > 0).length
      : 0;

    const branches = fileData.branchMap
      ? Object.keys(fileData.branchMap).length
      : 0;
    const coveredBranch = fileData.b
      ? Object.values(fileData.b)
          .flat()
          .filter((v) => v > 0).length
      : 0;

    const functions = fileData.fnMap ? Object.keys(fileData.fnMap).length : 0;
    const coveredFuncs = fileData.f
      ? Object.values(fileData.f).filter((v) => v > 0).length
      : 0;

    // Lines calculation (count unique line numbers in statementMap)
    const lineSet = new Set();
    if (fileData.statementMap) {
      for (const stmt of Object.values(fileData.statementMap)) {
        if (stmt.start && stmt.start.line) {
          lineSet.add(stmt.start.line);
        }
      }
    }
    const lines = lineSet.size;
    const coveredLns = fileData.s
      ? Object.keys(fileData.s)
          .filter((key) => fileData.s[key] > 0)
          .map((key) => fileData.statementMap[key]?.start?.line)
          .filter(Boolean).length
      : 0;

    // Get relative path for display
    const relativePath = normalizedPath.split("/src/components/")[1];

    componentFiles.push({
      path: relativePath,
      statements: { total: statements, covered: coveredStmts },
      branches: { total: branches, covered: coveredBranch },
      functions: { total: functions, covered: coveredFuncs },
      lines: { total: lines, covered: coveredLns },
    });

    totalStatements += statements;
    coveredStatements += coveredStmts;
    totalBranches += branches;
    coveredBranches += coveredBranch;
    totalFunctions += functions;
    coveredFunctions += coveredFuncs;
    totalLines += lines;
    coveredLines += coveredLns;
  }
}

// Calculate percentages
const stmtPct =
  totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0;
const branchPct =
  totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0;
const funcPct =
  totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0;
const linePct = totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;

// Output results
console.log("=".repeat(70));
console.log("src/components Coverage Summary");
console.log("=".repeat(70));
console.log(`Files analyzed: ${componentFiles.length}`);
console.log("");
console.log("Overall Coverage:");
console.log(
  `  Statements: ${coveredStatements}/${totalStatements} (${stmtPct.toFixed(
    2
  )}%)`
);
console.log(
  `  Branches:   ${coveredBranches}/${totalBranches} (${branchPct.toFixed(2)}%)`
);
console.log(
  `  Functions:  ${coveredFunctions}/${totalFunctions} (${funcPct.toFixed(2)}%)`
);
console.log(
  `  Lines:      ${coveredLines}/${totalLines} (${linePct.toFixed(2)}%)`
);
console.log("");

// Calculate gap to 50% target (using lines as primary metric)
const target = 50;
const gap = target - linePct;
console.log(`Target: ${target}% line coverage`);
console.log(`Current: ${linePct.toFixed(2)}%`);
console.log(`Gap: ${gap > 0 ? `${gap.toFixed(2)}%` : "TARGET REACHED!"}`);
console.log("");

// Show top uncovered files (by line coverage)
console.log("Top 10 Files by Coverage (Lines):");
console.log("-".repeat(70));
componentFiles
  .sort((a, b) => {
    const pctA = a.lines.total > 0 ? a.lines.covered / a.lines.total : 0;
    const pctB = b.lines.total > 0 ? b.lines.covered / b.lines.total : 0;
    return pctB - pctA;
  })
  .slice(0, 10)
  .forEach((file) => {
    const pct =
      file.lines.total > 0 ? (file.lines.covered / file.lines.total) * 100 : 0;
    console.log(`  ${file.path.padEnd(45)} ${pct.toFixed(1).padStart(6)}%`);
  });

console.log("=".repeat(70));
