import { readFile, writeFile } from "node:fs/promises";

const cyclonedx = JSON.parse(await readFile("hedge-decision-cockpit.cdx.json", "utf8"));
const spdx = JSON.parse(await readFile("hedge-decision-cockpit.spdx.json", "utf8"));

const normalize = (value) => String(value ?? "").trim();
const key = (name, version) => `${normalize(name).toLowerCase()}@${normalize(version).toLowerCase()}`;

const cyclonePackages = (cyclonedx.components ?? [])
  .map((component) => ({
    name: normalize(component.name),
    version: normalize(component.version),
    type: normalize(component.type),
    reference: normalize(component["bom-ref"]),
  }))
  .filter((entry) => entry.name);

const spdxPackages = (spdx.packages ?? [])
  .map((pkg) => ({
    name: normalize(pkg.name),
    version: normalize(pkg.versionInfo),
    identifier: normalize(pkg.SPDXID),
  }))
  .filter((entry) => entry.name);

const cycloneKeys = new Set(cyclonePackages.map((entry) => key(entry.name, entry.version)));
const spdxKeys = new Set(spdxPackages.map((entry) => key(entry.name, entry.version)));
const sharedPackages = [...cycloneKeys].filter((entry) => spdxKeys.has(entry)).sort();

const summary = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  image: "hedge-decision-cockpit:ci",
  cyclonedx: {
    specificationVersion: normalize(cyclonedx.specVersion),
    packageCount: cyclonePackages.length,
  },
  spdx: {
    specificationVersion: normalize(spdx.spdxVersion),
    packageCount: spdxPackages.length,
  },
  consistency: {
    sharedPackageCount: sharedPackages.length,
    smallerInventoryCount: Math.min(cycloneKeys.size, spdxKeys.size),
    exactOverlapPercent: Number(
      ((sharedPackages.length / Math.max(1, Math.min(cycloneKeys.size, spdxKeys.size))) * 100).toFixed(1),
    ),
  },
  sharedPackages,
};

await writeFile(
  "hedge-decision-cockpit.sbom-summary.json",
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);

console.log(
  `SBOM inventory summary generated: ${cyclonePackages.length} CycloneDX packages, ${spdxPackages.length} SPDX packages, ${sharedPackages.length} exact matches`,
);
