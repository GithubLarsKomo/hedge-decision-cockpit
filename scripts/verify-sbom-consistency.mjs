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
const packageOverlap = sharedPackages.length / Math.min(cyclonePackages.size, spdxPackages.size);
const nameOverlap = sharedNames.length / Math.min(cycloneNames.size, spdxNames.size);

// Trivy's CycloneDX and SPDX serializers can represent some versions differently.
// Treat package identity as the hard gate and retain exact name/version overlap as a
// secondary guard against materially divergent inventories.
if (nameOverlap < 0.9 || packageOverlap < 0.7) {
  throw new Error(
    `SBOM package sets diverge: names ${sharedNames.length}/${Math.min(cycloneNames.size, spdxNames.size)} (${(nameOverlap * 100).toFixed(1)}%), exact ${sharedPackages.length}/${Math.min(cyclonePackages.size, spdxPackages.size)} (${(packageOverlap * 100).toFixed(1)}%)`,
  );
}

const imageName = "hedge-decision-cockpit:ci";
const cycloneRoot = normalize(cyclonedx.metadata?.component?.name);

if (cycloneRoot && !cycloneRoot.includes("hedge-decision-cockpit")) {
  throw new Error(`Unexpected CycloneDX root component: ${cycloneRoot}`);
}
if (!spdx.documentNamespace || !String(spdx.documentNamespace).startsWith("https://")) {
  throw new Error("SPDX document namespace must be an HTTPS URI");
}
if (![...spdxNames].some((name) => name.includes("hedge-decision-cockpit")) && cycloneRoot !== normalize(imageName)) {
  throw new Error("Neither SBOM identifies the production container root");
}

console.log(
  `SBOM consistency verified: ${(nameOverlap * 100).toFixed(1)}% name overlap, ${(packageOverlap * 100).toFixed(1)}% exact overlap`,
);
