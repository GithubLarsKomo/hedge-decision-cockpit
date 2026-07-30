import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";

const files = [
  "hedge-decision-cockpit.cdx.json",
  "hedge-decision-cockpit.spdx.json",
  "hedge-decision-cockpit.sbom-summary.json",
  "hedge-decision-cockpit.provenance.json",
  "hedge-decision-cockpit.intoto.json",
];

const artifacts = [];
for (const path of files) {
  const [content, metadata] = await Promise.all([readFile(path), stat(path)]);
  artifacts.push({
    path,
    bytes: metadata.size,
    sha256: createHash("sha256").update(content).digest("hex"),
  });
}

const index = {
  schemaVersion: 1,
  repository: process.env.GITHUB_REPOSITORY ?? null,
  commit: process.env.GITHUB_SHA ?? null,
  workflowRunId: process.env.GITHUB_RUN_ID ?? null,
  generatedAt: new Date().toISOString(),
  artifacts,
};

await writeFile(
  "hedge-decision-cockpit.supply-chain-index.json",
  `${JSON.stringify(index, null, 2)}\n`,
);

console.log(`Supply-chain evidence index generated for ${artifacts.length} artifacts`);
