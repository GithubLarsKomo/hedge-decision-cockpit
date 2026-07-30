import { readFile } from "node:fs/promises";

const cyclonedx = JSON.parse(await readFile("hedge-decision-cockpit.cdx.json", "utf8"));
const spdx = JSON.parse(await readFile("hedge-decision-cockpit.spdx.json", "utf8"));

const normalize = (value) => String(value ?? "").trim().toLowerCase();
const key = (name, version) => `${normalize(name)}@${normalize(version)}`;

const cyclonePackages = new Set(
  (cyclonedx.components ?? [])
    .map((component) => key(component.name, component.version))
    .filter((entry) => entry !== "@"),
);
const spdxPackages = new Set(
  (spdx.packages ?? [])
    .map((pkg) => key(pkg.name, pkg.versionInfo))
    .filter((entry) => entry !== "@"),
);

if (cyclonePackages.size === 0 || spdxPackages.size === 0) {
  throw new Error("Both SBOM formats must contain packages");
}

const shared = [...cyclonePackages].filter((entry) => spdxPackages.has(entry));
const smallerSetSize = Math.min(cyclonePackages.size, spdxPackages.size);
const overlapRatio = shared.length / smallerSetSize;

if (overlapRatio < 0.9) {
  throw new Error(
    `SBOM package sets diverge: ${shared.length}/${smallerSetSize} shared (${(overlapRatio * 100).toFixed(1)}%)`,
  );
}

const imageName = "hedge-decision-cockpit:ci";
const cycloneRoot = normalize(cyclonedx.metadata?.component?.name);
const spdxNames = (spdx.packages ?? []).map((pkg) => normalize(pkg.name));

if (cycloneRoot && !cycloneRoot.includes("hedge-decision-cockpit")) {
  throw new Error(`Unexpected CycloneDX root component: ${cycloneRoot}`);
}
if (!spdx.documentNamespace || !String(spdx.documentNamespace).startsWith("https://")) {
  throw new Error("SPDX document namespace must be an HTTPS URI");
}
if (!spdxNames.some((name) => name.includes("hedge-decision-cockpit")) && cycloneRoot !== normalize(imageName)) {
  throw new Error("Neither SBOM identifies the production container root");
}

console.log(`SBOM consistency verified: ${shared.length} shared packages, ${(overlapRatio * 100).toFixed(1)}% overlap`);
