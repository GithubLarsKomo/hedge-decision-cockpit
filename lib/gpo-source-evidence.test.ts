import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  bindGpoSourceEvidence,
  canonicalizeGpoSourceEvidence,
  computeGpoSourceEvidenceFingerprint,
  validateGpoSourceEvidence
} from './gpo-source-evidence';
import { computeGpoTargetAllocationFingerprint } from './gpo-target-allocation';
import type { MonthlyPortfolioInput } from './portfolio-snapshot-generator';

function fixture(path: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), path), 'utf8'));
}

const allocation = fixture('fixtures/gpo-target-allocation/2026-08.json');
const evidence = fixture('fixtures/gpo-source-evidence/2026-08.json');
const monthlyInput = fixture('fixtures/portfolio-snapshot/monthly-input.json') as MonthlyPortfolioInput;

test('canonical evidence fixture binds to the exact target allocation fingerprint', () => {
  const parsed = validateGpoSourceEvidence(evidence);
  assert.equal(parsed.supported_allocation_fingerprint, computeGpoTargetAllocationFingerprint(allocation));

  const result = bindGpoSourceEvidence(monthlyInput, allocation, evidence);
  const expectedEvidenceFingerprint = computeGpoSourceEvidenceFingerprint(evidence);

  assert.deepEqual(result, {
    ...monthlyInput,
    source_fingerprints: [
      ...monthlyInput.source_fingerprints,
      `gpo-source-evidence:${expectedEvidenceFingerprint}`
    ]
  });
});

test('evidence fingerprint is deterministic across object key order', () => {
  const reordered = Object.fromEntries(Object.entries(evidence as Record<string, unknown>).reverse());
  assert.equal(canonicalizeGpoSourceEvidence(evidence), canonicalizeGpoSourceEvidence(reordered));
  assert.equal(computeGpoSourceEvidenceFingerprint(evidence), computeGpoSourceEvidenceFingerprint(reordered));
});

test('semantic evidence change changes its fingerprint', () => {
  const changed = { ...(evidence as Record<string, unknown>), locator: 'local-archive:gpo/2026-07-31/revised.pdf' };
  assert.notEqual(computeGpoSourceEvidenceFingerprint(evidence), computeGpoSourceEvidenceFingerprint(changed));
});

test('binding is idempotent for the same evidence fingerprint', () => {
  const once = bindGpoSourceEvidence(monthlyInput, allocation, evidence);
  const twice = bindGpoSourceEvidence(once, allocation, evidence);
  assert.deepEqual(twice, once);
});

test('rejects evidence retrieved before it was observed', () => {
  const invalid = {
    ...(evidence as Record<string, unknown>),
    retrieved_at: '2026-07-30T08:00:00+02:00'
  };
  assert.throws(() => validateGpoSourceEvidence(invalid), /retrieved_at must not be earlier/);
});

test('rejects evidence bound to a different allocation fingerprint', () => {
  const mismatched = {
    ...(evidence as Record<string, unknown>),
    supported_allocation_fingerprint: '0'.repeat(64)
  };
  assert.throws(
    () => bindGpoSourceEvidence(monthlyInput, allocation, mismatched),
    /does not match target allocation fingerprint/
  );
});
