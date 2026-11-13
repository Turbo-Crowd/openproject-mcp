#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const patterns = [
  {
    name: "private network hostname",
    expression: /https?:\/\/[^\s"'<>]+\.(?:internal|local|lan|corp|private)(?::\d+)?(?:[/\s"'<>]|$)/i,
  },
  {
    name: "personal home-directory path",
    expression: /(?:^|[^A-Za-z0-9_])\/(?:home|Users)\/[A-Za-z0-9_.-]+(?:\/|$)/,
  },
  {
    name: "private repository placeholder",
    expression: /(?:github\.com|gitlab\.com|bitbucket\.org)\/(?:private|internal)[A-Za-z0-9_.-]*\/[A-Za-z0-9_.-]+/i,
  },
];

function findViolation(content) {
  return patterns.find(({ expression }) => expression.test(content));
}

function sourceFiles() {
  return execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" })
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
}

function workingTreeFiles() {
  return execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "buffer" })
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
}

function scanFiles(files) {
  const violations = [];

  for (const file of files) {
    const content = readFileSync(file);
    // Binary assets cannot meaningfully contain public source literals.
    if (content.includes(0)) continue;

    const violation = findViolation(content.toString("utf8"));
    if (violation) violations.push(`${file}: ${violation.name}`);
  }

  return violations;
}

function negativeControlViolations() {
  const synthetic = [
    ["https://portal", ".internal/api"].join(""),
    ["/home/", "example-user/project"].join(""),
    ["https://github.com/", "private-org/private-repo"].join(""),
  ].join("\n");

  return patterns
    .filter(({ expression }) => expression.test(synthetic))
    .map(({ name }) => `synthetic fixture: ${name}`);
}

if (process.argv.includes("--negative-control")) {
  const violations = negativeControlViolations();
  if (violations.length !== patterns.length) {
    throw new Error("Negative control did not trigger every sanitization pattern.");
  }
  console.error("Public sanitization check failed as expected:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

const violations = scanFiles(sourceFiles());
const untrackedViolations = scanFiles(workingTreeFiles());
if (violations.length > 0 || untrackedViolations.length > 0) {
  console.error("Public sanitization check failed:");
  for (const violation of [...new Set([...violations, ...untrackedViolations])]) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Public sanitization check passed for all tracked text files.");
