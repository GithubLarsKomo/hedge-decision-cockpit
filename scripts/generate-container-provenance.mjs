import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const imageName = "hedge-decision-cockpit:ci";
const sbomPath = "hedge-decision-cockpit.cdx.json";
const imageId = execFileSync("docker", ["image", "inspect", imageName, "--format", "{{.Id}}"], { encoding: "utf8" }).trim();
const imageDigest = imageId.replace(/^sha256:/, "");
const sbom = await readFile(sbomPath);
const sbomDigest = createHash("sha256").update(sbom).digest("hex");
const repository = process.env.GITHUB_REPOSITORY;
const commitSha = process.env.GITHUB_SHA;
const workflowRef = process.env.GITHUB_WORKFLOW_REF;
const runId = process.env.GITHUB_RUN_ID;

if (!repository || !commitSha || !workflowRef || !runId) {
  throw new Error("Required GitHub Actions provenance environment is missing");
}
if (!/^[a-f0-9]{64}$/.test(imageDigest) || !/^[a-f0-9]{64}$/.test(sbomDigest)) {
  throw new Error("Invalid container or SBOM digest");
}

const manifest = {
  schemaVersion: "1",
  repository,
  commitSha,
  workflowRef,
  runId,
  imageId,
  sbom: { path: sbomPath, sha256: sbomDigest },
};

const statement = {
  _type: "https://in-toto.io/Statement/v1",
  subject: [{ name: imageName, digest: { sha256: imageDigest } }],
  predicateType: "https://slsa.dev/provenance/v1",
  predicate: {
    buildDefinition: {
      buildType: "https://github.com/Attestations/GitHubActionsWorkflow@v1",
      externalParameters: { repository, commitSha, workflowRef },
      internalParameters: { runId },
      resolvedDependencies: [{
        uri: `git+https://github.com/${repository}@${commitSha}`,
        digest: { gitCommit: commitSha },
      }],
    },
    runDetails: {
      builder: { id: `https://github.com/${repository}/actions/runs/${runId}` },
      metadata: { invocationId: runId },
      byproducts: [{ name: sbomPath, digest: { sha256: sbomDigest } }],
    },
  },
};

await writeFile("hedge-decision-cockpit.provenance.json", `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile("hedge-decision-cockpit.intoto.json", `${JSON.stringify(statement, null, 2)}\n`);
