import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMarketSnapshotIngestBody } from './market-snapshot-ingest';

test('normalizes a single market observation', () => {
  const [snapshot] = normalizeMarketSnapshotIngestBody({
    observedAt: '2026-08-03T20:00:00Z',
    source: 'manual-test',
    ndxClose: 28000,
    ndxReferenceHigh: 28500,
    vixClose: 18.2
  });
  assert.equal(snapshot.source, 'manual-test');
  assert.ok(snapshot.ndxDrawdownPercent < 0);
});

test('normalizes and sorts an observations batch', () => {
  const snapshots = normalizeMarketSnapshotIngestBody({ observations: [
    { observedAt: '2026-08-02T20:00:00Z', source: 'provider', ndxClose: 27900, ndxReferenceHigh: 28500, vixClose: 19 },
    { observedAt: '2026-08-01T20:00:00Z', source: 'provider', ndxClose: 28100, ndxReferenceHigh: 28500, vixClose: 17 }
  ] });
  assert.equal(snapshots[0].observedAt, '2026-08-01T20:00:00.000Z');
  assert.equal(snapshots.length, 2);
});

test('rejects an empty observations batch', () => {
  assert.throws(() => normalizeMarketSnapshotIngestBody({ observations: [] }), /At least one market observation/);
});
