import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  canonicalizePortfolioSnapshot,
  computePortfolioSnapshotFingerprint,
  validatePortfolioSnapshot
} from './portfolio-snapshot';

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), 'fixtures', 'portfolio-snapshot', name), 'utf8'));
}

describe('portfolio snapshot contract', () => {
  it('validates the canonical fixture and reproduces its fingerprint', () => {
    const value = fixture('valid.json') as { input_fingerprint: string };
    const parsed = validatePortfolioSnapshot(value);
    assert.equal(parsed.schema_version, 'portfolio-snapshot/1.0');
    assert.equal(computePortfolioSnapshotFingerprint(value), value.input_fingerprint);
  });

  it('canonicalizes object key order and insignificant whitespace deterministically', () => {
    const value = fixture('valid.json') as Record<string, unknown>;
    const reordered = Object.fromEntries(Object.entries(value).reverse());
    assert.equal(canonicalizePortfolioSnapshot(value), canonicalizePortfolioSnapshot(reordered));
    assert.equal(computePortfolioSnapshotFingerprint(value), computePortfolioSnapshotFingerprint(reordered));
  });

  it('changes the fingerprint when semantic content changes', () => {
    const value = fixture('valid.json') as Record<string, unknown>;
    const portfolio = value.portfolio as Record<string, unknown>;
    const changed = { ...value, portfolio: { ...portfolio, monthly_contribution: 1600 } };
    assert.notEqual(computePortfolioSnapshotFingerprint(value), computePortfolioSnapshotFingerprint(changed));
  });

  it('rejects an active purchase instrument that is not mapped', () => {
    assert.throws(() => validatePortfolioSnapshot(fixture('invalid-active-instrument.json')), /active_purchase_instrument/);
  });

  it('rejects weights outside the closed interval zero to one', () => {
    assert.throws(() => validatePortfolioSnapshot(fixture('invalid-weight.json')));
  });

  it('rejects duplicate exposure identifiers', () => {
    assert.throws(() => validatePortfolioSnapshot(fixture('invalid-duplicate-exposure.json')), /exposure_id must be unique/);
  });

  it('rejects a structurally valid snapshot with a mismatched fingerprint', () => {
    const value = fixture('valid.json') as Record<string, unknown>;
    const tampered = { ...value, input_fingerprint: `sha256:${'0'.repeat(64)}` };
    assert.throws(() => validatePortfolioSnapshot(tampered), /input_fingerprint mismatch/);
  });
});
