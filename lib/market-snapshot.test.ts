import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeMarketSnapshot, normalizeMarketSnapshotBatch } from './market-snapshot';

const base = {
  observedAt: '2020-03-16T20:00:00Z',
  source: 'historical-import',
  ndxClose: 7000,
  ndxReferenceHigh: 9800,
  vixClose: 82.69,
  vxnClose: 80.08,
  riskFreeRate: 0.005,
  dividendYield: 0.01
};

describe('market snapshots', () => {
  it('normalizes timestamps, drawdown and content hash deterministically', () => {
    const first = normalizeMarketSnapshot(base);
    const second = normalizeMarketSnapshot({ ...base, source: ' historical-import ' });
    assert.equal(first.observedAt, '2020-03-16T20:00:00.000Z');
    assert.equal(first.ndxDrawdownPercent, -28.571429);
    assert.equal(first.contentHash, second.contentHash);
    assert.match(first.contentHash, /^[a-f0-9]{64}$/);
  });

  it('sorts batches chronologically', () => {
    const result = normalizeMarketSnapshotBatch([
      { ...base, observedAt: '2022-01-03T20:00:00Z' },
      base
    ]);
    assert.equal(result[0].observedAt, '2020-03-16T20:00:00.000Z');
  });

  it('rejects duplicate source and timestamp pairs', () => {
    assert.throws(() => normalizeMarketSnapshotBatch([base, { ...base, ndxClose: 6900 }]), /Duplicate source and timestamp/);
  });

  it('rejects internally inconsistent NDX values', () => {
    assert.throws(() => normalizeMarketSnapshot({ ...base, ndxClose: 10000 }), /cannot exceed/);
  });
});