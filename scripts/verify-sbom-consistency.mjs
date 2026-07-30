import { readFile } from "node:fs/promises";

const cyclonedx = JSON.parse(await readFile("hedge-decision-cockpit.cdx.json", "utf8"));
const spdx = JSON.parse(await readFile("hedge-decision-cockpit.spdx.json", "utf8"));

const normalize = (value) => String(value ?? "").trim().toLowerCase();
const key = (name, version) => `${normalize(name)}@${normalize(version)}`;

const cycloneComponents = cyclonedx.components ?? [];
const spdxPackageList = spdx.packages ?? [];
const cyclonePackages = new Set(
  cycloneComponents.map((component) => key(component.name, component.version)).filter((entry) => entry !== "@"),
);
const spdxPackages = new Set(
  spdxPackageList.map((pkg) => key(pkg.name, pkg.versionInfo)).filter((entry) => entry !== "@"),
);
const cycloneNames = new Set(cycloneComponents.map((component) => normalize(component.name)).filter(Boolean));
const spdxNames = new Set(spdxPackageList.map((pkg) => normalize(pkg.name)).filter(Boolean));

if (cyclonePackages.size === 0 || spdxPackages.size === 0) {
  throw new Error("Both SBOM formats must contain packages");
}

const sharedPackages = [...cyclonePackages].filter((entry) => spdxPackages.has(entry));
const sharedNames = [...cycloneNames].filter((entry) => spdxNames.has(entry));
const smallerPackageSet = Math.min(cyclonePackages.size, spdxPackages.size);
const smallerNameSet = Math.min(cycloneNames.size, spdxNames.size);
const packageOverlap = sharedPackages.length / smallerPackageSet;
const nameOverlap = sharedNames.length / smallerNameSet;
const inventorySizeRatio = smallerPackageSet / Math.max(cyclonePackages.size, spdxPackages.size);

// Trivy's CycloneDX and SPDX serializers intentionally expose partially different
// inventories for the same image. A 70% overlap still catches material divergence,
// while the size-ratio guard prevents a truncated SBOM from passing accidentally.
if (nameOverlap < 0.7 || packageOverlap < 0.7 || inventorySizeRatio < 0.7) {
  throw new Error(
    `SBOM package sets diverge: names ${sharedNames.length}/${smallerNameSet} (${(nameOverlap * 100).toFixed(1)}%), exact ${sharedPackages.length}/${smallerPackageSet} (${(packageOverlap * 100).toFixed(1)}%), size ratio ${(inventorySizeRatio * 100).toFixed(1)}%`,
  );
}

const imageName = "hedge-decision-cockpit:ci";
const cycloneRoot = normalize(cyclonedx.metadata?.component?.name);

if (cycloneRoot && !cycloneRoot.includes("hedge-decision-cockpit")) {
  throw new Error(`Unexpected CycloneDX root component: ${cycloneRoot}`);
}

let namespace;
try {
  namespace = new URL(String(spdx.documentNamespace));
} catch {
  throw new Error("SPDX document namespace must be an absolute URI");
}
if (!namespace.protocol || !namespace.pathname) {
  throw new Error("SPDX document namespace must be an absolute URI");
}

if (![...spdxNames].some((name) => name.includes("hedge-decision-cockpit")) && cycloneRoot !== normalize(imageName)) {
  throw new Error("Neither SBOM identifies the production container root");
}

console.log(
  `SBOM consistency verified: ${(nameOverlap * 100).toFixed(1)}% name overlap, ${(packageOverlap * 100).toFixed(1)}% exact overlap, ${(inventorySizeRatio * 100).toFixed(1)}% size ratio`,
);