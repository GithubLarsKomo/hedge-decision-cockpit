import assert from 'node:assert/strict';
import test from 'node:test';
import { importMarketSnapshotCsv } from './market-snapshot-csv';

test('imports and chronologically sorts historical market snapshots', () => {
  const csv = [
    'observedAt,ndxClose,ndxReferenceHigh,vixClose,vxnClose,riskFreeRate,dividendYield',
    '2020-03-20T00:00:00Z,6994.29,9817.18,66.04,71.14,0.0025,0.008',
    '2020-02-19T00:00:00Z,9718.73,9718.73,14.38,16.20,0.015,0.008'
  ].join('\n');

  const snapshots = importMarketSnapshotCsv(csv, { source: 'stress-fixture' });
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[0].observedAt, '2020-02-19T00:00:00.000Z');
  assert.equal(snapshots[1].source, 'stress-fixture');
  assert.ok(snapshots[1].ndxDrawdownPercent < -28);
  assert.match(snapshots[0].contentHash, /^[a-f0-9]{64}$/);
});

test('supports semicolon-separated files and quoted fields', () => {
  const csv = [
    'observedAt;ndxClose;ndxReferenceHigh;vixClose',
    '"2022-01-03T00:00:00Z";16501.77;16501.77;16.60'
  ].join('\n');
  const snapshots = importMarketSnapshotCsv(csv, { source: 'vendor;export', delimiter: ';' });
  assert.equal(snapshots[0].ndxClose, 16501.77);
});

test('rejects missing columns, malformed rows and invalid numbers', () => {
  assert.throws(
    () => importMarketSnapshotCsv('observedAt,ndxClose\n2020-01-01,100', { source: 'x' }),
    /Missing required CSV column/
  );
  assert.throws(
    () => importMarketSnapshotCsv('observedAt,ndxClose,ndxReferenceHigh\n2020-01-01,abc,100', { source: 'x' }),
    /Invalid ndxClose/
  );
  assert.throws(
    () => importMarketSnapshotCsv('observedAt,ndxClose,ndxReferenceHigh\n2020-01-01,100', { source: 'x' }),
    /has 2 fields; expected 3/
  );
});

test('preserves batch duplicate detection', () => {
  const csv = [
    'observedAt,ndxClose,ndxReferenceHigh',
    '2020-01-01T00:00:00Z,100,100',
    '2020-01-01T00:00:00Z,100,100'
  ].join('\n');
  assert.throws(() => importMarketSnapshotCsv(csv, { source: 'duplicate' }), /Duplicate source and timestamp/);
});
