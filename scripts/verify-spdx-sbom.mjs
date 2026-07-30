import { readFile } from "node:fs/promises";

const path = "hedge-decision-cockpit.spdx.json";
const document = JSON.parse(await readFile(path, "utf8"));

if (typeof document.spdxVersion !== "string" || !document.spdxVersion.startsWith("SPDX-2.")) {
  throw new Error("Unsupported or missing SPDX version");
}
if (document.dataLicense !== "CC0-1.0") {
  throw new Error("Unexpected SPDX data license");
}
if (document.SPDXID !== "SPDXRef-DOCUMENT") {
  throw new Error("Invalid SPDX document identifier");
}
if (typeof document.documentNamespace !== "string" || !document.documentNamespace.startsWith("http")) {
  throw new Error("Missing SPDX document namespace");
}
if (!Array.isArray(document.packages) || document.packages.length === 0) {
  throw new Error("SPDX SBOM contains no packages");
}

const packageIds = new Set();
for (const pkg of document.packages) {
  if (typeof pkg.name !== "string" || pkg.name.length === 0) {
    throw new Error("SPDX package is missing a name");
  }
  if (typeof pkg.SPDXID !== "string" || !pkg.SPDXID.startsWith("SPDXRef-")) {
    throw new Error(`SPDX package ${pkg.name} has an invalid identifier`);
  }
  if (packageIds.has(pkg.SPDXID)) {
    throw new Error(`Duplicate SPDX package identifier: ${pkg.SPDXID}`);
  }
  packageIds.add(pkg.SPDXID);
}

console.log(`Validated SPDX SBOM with ${document.packages.length} packages`);
