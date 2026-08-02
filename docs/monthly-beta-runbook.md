# Monthly portfolio-to-hedge beta runbook

This runbook covers the first local beta use of the reproducible monthly portfolio bundle flow. The workflow is decision-support only: it does not place orders, switch ETF mappings automatically, or call a broker.

## 1. Preflight

From the repository root, make sure dependencies and the Prisma schema are ready:

```bash
npm ci
npm run prisma:generate
npm run prisma:push
```

Run the deterministic smoke test before using personal monthly data:

```bash
npm run smoke:monthly-bundle
```

Expected success signal:

```text
MONTHLY_BETA_SMOKE_OK bundle=sha256:... snapshot=2026-08
```

A non-zero exit or `MONTHLY_BETA_SMOKE_FAILED` means the real monthly run should not be attempted until the cause is fixed.

## 2. Run a real monthly bundle

Use the existing canonical CLI with exactly one bundle JSON file:

```bash
npm run run:monthly-bundle-decision-report -- path/to/monthly-run-bundle.json
```

The command writes one stable JSON report to stdout. Save it explicitly when desired:

```bash
npm run run:monthly-bundle-decision-report -- path/to/monthly-run-bundle.json > monthly-report.json
```

Successful output should contain a `bundleFingerprint`, the expected snapshot identity, provenance information, and decision variants. It must not contain an `order` or `selectedVariant` execution field.

## 3. Safe rerun

Valid reruns are expected and use the existing idempotent persistence path. Re-running the same validated bundle should produce a stably serialized report for the same persisted state.

If the bundle or any member changes, regenerate the corresponding fingerprint rather than editing fingerprints manually.

## 4. Recovery

### Malformed JSON

Symptom: JSON parse error and non-zero exit.

Action: fix the JSON syntax. No report should be emitted and the monthly workflow should not proceed.

### Fingerprint mismatch

Symptom: an error naming the monthly input, GPO target allocation, GPO source evidence, or ETF mapping fingerprint.

Action: treat the bundle as stale or tampered. Rebuild the bundle from the intended source values and recompute fingerprints using the canonical repository functions. Do not copy a previous fingerprint onto changed content.

### Prisma/schema error

Symptom: database/schema error before or during the local workflow.

Action:

```bash
npm run prisma:generate
npm run prisma:push
npm run smoke:monthly-bundle
```

Only resume the real monthly run after the smoke test is green.

### Unexpected report content

If `order`, `selectedVariant`, automatic ETF-switch behavior, or other execution semantics appear, stop using the result and treat it as a regression. The beta boundary is advisory decision support only.

## 5. Beta completion check

Before acting on a monthly report, confirm:

- the bundle fingerprint is present;
- the snapshot month is the intended month;
- source/provenance and ETF mapping review information are plausible;
- any surfaced human mapping review matches the mapping used by the bundle;
- the report contains no order-generation or automatic-selection semantics;
- the same bundle can be rerun deterministically.
