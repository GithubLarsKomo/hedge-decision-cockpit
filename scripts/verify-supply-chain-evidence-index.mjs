import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

const indexPath = "hedge-decision-cockpit.supply-chain-index.json";
const expectedPaths = [
  "hedge-decision-cockpit.cdx.json",
  "hedge-decision-cockpit.spdx.json",
  "hedge-decision-cockpit.sbom-summary.json",
  "hedge-decision-cockpit.provenance.json",
  "hedge-decision-cockpit.intoto.json",
];

const index = JSON.parse(await readFile(indexPath, "utf8"));

if (index.schemaVersion !== 1) {
  throw new Error(`Unsupported evidence index schemaVersion: ${index.schemaVersion}`);
}
if (!Array.isArray(index.artifacts) || index.artifacts.length !== expectedPaths.length) {
  throw new Error(`Evidence index must contain exactly ${expectedPaths.length} artifacts`);
}
if (Number.isNaN(Date.parse(index.generatedAt))) {
  throw new Error("Evidence index generatedAt must be a valid timestamp");
}

const expectedRepository = process.env.GITHUB_REPOSITORY;
const expectedCommit = process.env.GITHUB_SHA;
const expectedRunId = process.env.GITHUB_RUN_ID;
if (expectedRepository && index.repository !== expectedRepository) {
  throw new Error(`Evidence index repository mismatch: ${index.repository}`);
}
if (expectedCommit && index.commit !== expectedCommit) {
  throw new Error(`Evidence index commit mismatch: ${index.commit}`);
}
if (expectedRunId && index.workflowRunId !== expectedRunId) {
  throw new Error(`Evidence index workflow run mismatch: ${index.workflowRunId}`);
}

const indexedPaths = index.artifacts.map((artifact) => artifact.path);
if (new Set(indexedPaths).size !== indexedPaths.length) {
  throw new Error("Evidence index contains duplicate artifact paths");
}
for (const path of expectedPaths) {
  if (!indexedPaths.includes(path)) {
    throw new Error(`Evidence index is missing ${path}`);
  }
}

for (const artifact of index.artifacts) {
  if (!expectedPaths.includes(artifact.path)) {
    throw new Error(`Evidence index contains unexpected artifact: ${artifact.path}`);
  }
  const [content, metadata] = await Promise.all([readFile(artifact.path), stat(artifact.path)]);
  const digest = createHash("sha256").update(content).digest("hex");
  if (artifact.bytes !== metadata.size) {
    throw new Error(`Evidence index size mismatch for ${artifact.path}`);
  }
  if (!/^[a-f0-9]{64}$/.test(artifact.sha256) || artifact.sha256 !== digest) {
    throw new Error(`Evidence index digest mismatch for ${artifact.path}`);
  }
}

console.log(`Supply-chain evidence index verified for ${expectedPaths.length} artifacts`);
