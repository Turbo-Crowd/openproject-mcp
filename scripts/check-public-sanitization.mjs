#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Public sources may refer only to these documentation and service domains.
const allowedDomainSuffixes = [
  "bun.sh",
  "example.com",
  "github.com",
  "glama.ai",
  "modelcontextprotocol.io",
  "npmjs.org",
  "semver.org",
  "w3.org",
];
const historicalDenyHashes = new Set([
  "8238aeaab73b9a6a1a0e60a7047350e0b2df450e65e32d6835e901fe36fc2be5",
  "163596daeb7067737fac7efa8c79ef359c4449b559f442198f7adb5c9ccc9a69",
  "23a2a6ee54f30f367d47875409a3406b12b31d7d8d6ab4836491dd1f4f0c9de7",
]);

function normalize(value) {
  return value.normalize("NFKC").trim().toLowerCase();
}

function digest(value) {
  return createHash("sha256").update(normalize(value)).digest("hex");
}

function isAllowedDomain(domain) {
  return domain === "localhost" || domain.endsWith(".invalid") || domain.endsWith(".localhost") || allowedDomainSuffixes.some(
    (suffix) => domain === suffix || domain.endsWith(`.${suffix}`),
  );
}

function domainCandidates(content) {
  const candidates = new Set();
  const tlds = "ai|app|biz|cloud|co|com|corp|dev|edu|gov|info|internal|invalid|io|lan|local|localhost|net|org|private|sh|uk";
  const expression = new RegExp(`(?:https?:\\/\\/)((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+(?:${tlds}))(?::\\d+)?(?:[/?#:]|\\b)`, "gi");
  for (const match of content.matchAll(expression)) candidates.add(match[1].toLowerCase());
  return candidates;
}

function exactSignatureMatch(content) {
  const candidates = content.match(/[A-Za-z0-9._/-]+/g) ?? [];
  for (const candidate of candidates) {
    const candidateDigest = digest(candidate);
    if (historicalDenyHashes.has(candidateDigest)) return candidateDigest.slice(0, 12);
  }
  return undefined;
}

const posixHomePattern = new RegExp(
  String.raw`(?:^|[^A-Za-z0-9_])\/(?:h` + String.raw`ome|Users)\/[A-Za-z0-9_.-]+(?:\/|$)`,
);
const windowsHomePattern = /[A-Za-z]:\\Users\\[A-Za-z0-9_.-]+(?:\\|$)/i;

function findViolation(content) {
  const exactDigestPrefix = exactSignatureMatch(content);
  if (exactDigestPrefix) return `historical signature sha256:${exactDigestPrefix}`;
  if (posixHomePattern.test(content)) {
    return "personal home-directory path";
  }
  if (windowsHomePattern.test(content)) {
    return "Windows user-profile path";
  }
  const privateRepoPattern = new RegExp(
    String.raw`\b(?:internal|private)[-_./]?(?:open` + String.raw`code|config)|(?:open` + String.raw`code|config)[-_./]?(?:internal|private)\b`,
    "i",
  );
  if (privateRepoPattern.test(content)) return "restricted repository token";
  for (const domain of domainCandidates(content)) {
    if (!isAllowedDomain(domain)) return `non-allowlisted domain sha256:${digest(domain).slice(0, 12)}`;
  }
  return undefined;
}

function sourceFiles() {
  return execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" }).toString("utf8").split("\0").filter(Boolean);
}

function workingTreeFiles() {
  return execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "buffer" }).toString("utf8").split("\0").filter(Boolean);
}

function isExcludedPath(file) {
  return ["node_modules/", "dist/", "build/", "coverage/"].some((directory) => file.startsWith(directory));
}

function scanFiles(files) {
  const violations = [];
  for (const file of files) {
    // Generated output and dependencies are excluded only by repository-relative path.
    if (isExcludedPath(file)) continue;
    const content = readFileSync(file);
    const violation = findViolation(content.toString("utf8"));
    if (violation) violations.push(`${file}: ${violation}`);
  }
  return violations;
}

function assertSelfTests() {
  const cases = [
    ["allowed public domain", "https://docs.example.com/guide", undefined],
    ["unknown customer domain", ["https://customer", ".test.invalid.example.net/api"].join(""), "non-allowlisted domain"],
    ["POSIX home path", ["/h", "ome/sample-user/project"].join(""), "personal home-directory path"],
    ["Windows profile path", "C:\\Users\\sample-user\\project", "Windows user-profile path"],
    ["private configuration semantics", ["private-", "config-repository"].join(""), "restricted repository token"],
  ];
  for (const [name, input, expected] of cases) {
    const violation = findViolation(input);
    if ((expected && !violation?.startsWith(expected)) || (!expected && violation)) {
      throw new Error(`Self-test failed: ${name}`);
    }
  }
  if (historicalDenyHashes.size !== 3 || [...historicalDenyHashes].some((hash) => !/^[a-f0-9]{64}$/.test(hash))) {
    throw new Error("Historical signature self-test failed.");
  }
  // Prove the exact-hash code path without retaining a historical literal.
  const synthetic = "self-test-exact-signature";
  const original = new Set(historicalDenyHashes);
  historicalDenyHashes.add(digest(synthetic));
  const matched = findViolation(synthetic)?.startsWith("historical signature sha256:");
  historicalDenyHashes.clear();
  for (const hash of original) historicalDenyHashes.add(hash);
  if (!matched) throw new Error("Exact-signature self-test failed.");
}

if (process.argv.includes("--self-test")) {
  assertSelfTests();
  console.log("Public sanitization self-tests passed.");
  process.exit(0);
}

const violations = [...new Set([...scanFiles(sourceFiles()), ...scanFiles(workingTreeFiles())])];
if (violations.length > 0) {
  console.error("Public sanitization check failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("Public sanitization check passed for all tracked text files.");
