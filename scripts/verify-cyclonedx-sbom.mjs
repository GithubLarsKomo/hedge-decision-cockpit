import { readFile } from "node:fs/promises";

const sbomPath = "hedge-decision-cockpit.cdx.json";
const raw = await readFile(sbomPath, "utf8");
const sbom = JSON.parse(raw);

const fail = (message) => {
  throw new Error(`CycloneDX SBOM validation failed: ${message}`);
};

if (sbom.bomFormat !== "CycloneDX") fail("bomFormat must be CycloneDX");
if (typeof sbom.specVersion !== "string" || !/^1\.[4-9]$/.test(sbom.specVersion)) {
  fail("unsupported or missing specVersion");
}
if (!Number.isInteger(sbom.version) || sbom.version < 1) fail("version must be a positive integer");
if (!Array.isArray(sbom.components) || sbom.components.length === 0) fail("components must not be empty");

const refs = new Set();
for (const [index, component] of sbom.components.entries()) {
  if (!component || typeof component !== "object") fail(`component ${index} is invalid`);
  if (typeof component.type !== "string" || component.type.length === 0) fail(`component ${index} has no type`);
  if (typeof component.name !== "string" || component.name.length === 0) fail(`component ${index} has no name`);
  if (typeof component["bom-ref"] !== "string" || component["bom-ref"].length === 0) {
    fail(`component ${index} has no bom-ref`);
  }
  if (refs.has(component["bom-ref"])) fail(`duplicate bom-ref ${component["bom-ref"]}`);
  refs.add(component["bom-ref"]);
}

if (sbom.metadata?.component && typeof sbom.metadata.component !== "object") {
  fail("metadata.component is invalid");
}

console.log(`Validated CycloneDX ${sbom.specVersion} SBOM with ${sbom.components.length} components.`);
