import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const imageName = "hedge-decision-cockpit:ci";
const sbomPath = "hedge-decision-cockpit.cdx.json";
const manifestPath = "hedge-decision-cockpit.provenance.json";
const statementPath = "hedge-decision-cockpit.intoto.json";

const [sbom, manifestRaw, statementRaw] = await Promise.all([
  readFile(sbomPath),
  readFile(manifestPath, "utf8"),
  readFile(statementPath, "utf8"),
]);

const manifest = JSON.parse(manifestRaw);
const statement = JSON.parse(statementRaw);
const expectedSbomDigest = createHash("sha256").update(sbom).digest("hex");
const expectedRepository = process.env.GITHUB_REPOSITORY;
const expectedCommitSha = process.env.GITHUB_SHA;
const expectedWorkflowRef = process.env.GITHUB_WORKFLOW_REF;
const expectedRunId = process.env.GITHUB_RUN_ID;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(manifest.schemaVersion === "1", "Unsupported provenance manifest schema");
assert(manifest.repository === expectedRepository, "Manifest repository does not match workflow context");
assert(manifest.commitSha === expectedCommitSha, "Manifest commit does not match workflow context");
assert(manifest.workflowRef === expectedWorkflowRef, "Manifest workflow reference does not match workflow context");
assert(manifest.runId === expectedRunId, "Manifest run ID does not match workflow context");
assert(manifest.sbom?.path === sbomPath, "Manifest references an unexpected SBOM path");
assert(manifest.sbom?.sha256 === expectedSbomDigest, "Manifest SBOM digest is invalid");
assert(/^sha256:[a-f0-9]{64}$/.test(manifest.imageId), "Manifest container image ID is invalid");

assert(statement._type === "https://in-toto.io/Statement/v1", "Unexpected in-toto statement type");
assert(statement.predicateType === "https://slsa.dev/provenance/v1", "Unexpected SLSA predicate type");
assert(statement.subject?.length === 1, "Provenance must contain exactly one subject");
assert(statement.subject[0]?.name === imageName, "Provenance subject name is invalid");
assert(statement.subject[0]?.digest?.sha256 === manifest.imageId.slice(7), "Provenance subject digest does not match manifest image ID");
assert(statement.predicate?.buildDefinition?.externalParameters?.repository === expectedRepository, "Provenance repository is invalid");
assert(statement.predicate?.buildDefinition?.externalParameters?.commitSha === expectedCommitSha, "Provenance commit is invalid");
assert(statement.predicate?.buildDefinition?.externalParameters?.workflowRef === expectedWorkflowRef, "Provenance workflow reference is invalid");
assert(statement.predicate?.buildDefinition?.internalParameters?.runId === expectedRunId, "Provenance run ID is invalid");
assert(statement.predicate?.buildDefinition?.resolvedDependencies?.[0]?.digest?.gitCommit === expectedCommitSha, "Resolved source commit is invalid");
assert(statement.predicate?.runDetails?.metadata?.invocationId === expectedRunId, "Provenance invocation ID is invalid");
assert(statement.predicate?.runDetails?.byproducts?.[0]?.name === sbomPath, "Provenance SBOM byproduct is missing");
assert(statement.predicate?.runDetails?.byproducts?.[0]?.digest?.sha256 === expectedSbomDigest, "Provenance SBOM digest is invalid");

console.log("Supply-chain provenance policy validated");
