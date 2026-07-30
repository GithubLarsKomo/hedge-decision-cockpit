#!/usr/bin/env bash
set -euo pipefail

archive=${1:-hedge-decision-cockpit.supply-chain-evidence.tar.gz}
sidecar=${2:-${archive}.sha256}

for command in sha256sum tar jq; do
  command -v "$command" >/dev/null || {
    echo "required command not found: $command" >&2
    exit 2
  }
done

[[ -f "$archive" ]] || { echo "archive not found: $archive" >&2; exit 2; }
[[ -f "$sidecar" ]] || { echo "digest sidecar not found: $sidecar" >&2; exit 2; }

archive_name=$(basename "$archive")
sidecar_name=$(basename "$sidecar")
workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT

cp "$archive" "$workdir/$archive_name"
cp "$sidecar" "$workdir/$sidecar_name"
(
  cd "$workdir"
  sha256sum --check "$sidecar_name"
)

mkdir "$workdir/extracted"
tar -xzf "$archive" -C "$workdir/extracted" --no-same-owner

expected=(
  hedge-decision-cockpit.cdx.json
  hedge-decision-cockpit.spdx.json
  hedge-decision-cockpit.sbom-summary.json
  hedge-decision-cockpit.provenance.json
  hedge-decision-cockpit.intoto.json
  hedge-decision-cockpit.supply-chain-index.json
  hedge-decision-cockpit.sha256
)

mapfile -t actual < <(find "$workdir/extracted" -maxdepth 1 -type f -printf '%f\n' | sort)
printf '%s\n' "${expected[@]}" | sort > "$workdir/expected.txt"
printf '%s\n' "${actual[@]}" > "$workdir/actual.txt"
diff -u "$workdir/expected.txt" "$workdir/actual.txt"

(
  cd "$workdir/extracted"
  sha256sum --check hedge-decision-cockpit.sha256
)

jq -e '.bomFormat == "CycloneDX"' "$workdir/extracted/hedge-decision-cockpit.cdx.json" >/dev/null
jq -e '.spdxVersion | startswith("SPDX-")' "$workdir/extracted/hedge-decision-cockpit.spdx.json" >/dev/null
jq -e 'type == "object"' "$workdir/extracted/hedge-decision-cockpit.provenance.json" >/dev/null
jq -e 'type == "object"' "$workdir/extracted/hedge-decision-cockpit.intoto.json" >/dev/null
jq -e 'type == "object"' "$workdir/extracted/hedge-decision-cockpit.supply-chain-index.json" >/dev/null

echo "Supply-chain evidence bundle verified: $archive"