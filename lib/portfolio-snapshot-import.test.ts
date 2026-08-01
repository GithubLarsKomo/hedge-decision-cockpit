import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { computePortfolioSnapshotFingerprint } from './portfolio-snapshot';
import {
  importPortfolioSnapshot,
  PortfolioSnapshotFingerprintConflictError,
  PortfolioSnapshotRevisionConflictError,
  type ImportedPortfolioSnapshotRecord,
  type PortfolioSnapshotImportStore
} from './portfolio-snapshot-import';

function validFixture(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(process.cwd(), 'fixtures', 'portfolio-snapshot', 'valid.json'), 'utf8'));
}

function withFingerprint(value: Record<string, unknown>) {
  return { ...value, input_fingerprint: computePortfolioSnapshotFingerprint(value) };
}

function memoryStore(): PortfolioSnapshotImportStore & { records: ImportedPortfolioSnapshotRecord[] } {
  const records: ImportedPortfolioSnapshotRecord[] = [];
  return {
    records,
    async findBySnapshotRevision(snapshotId, revision) {
      return records.find((record) => record.snapshotId === snapshotId && record.revision === revision) ?? null;
    },
    async findByFingerprint(inputFingerprint) {
      return records.find((record) => record.inputFingerprint === inputFingerprint) ?? null;
    },
    async create(data) {
      records.push(data);
      return data;
    }
  };
}

test('creates a valid portfolio snapshot exactly once', async () => {
  const store = memoryStore();
  const first = await importPortfolioSnapshot(store, validFixture());
  const second = await importPortfolioSnapshot(store, validFixture());
  assert.equal(first.status, 'created');
  assert.equal(second.status, 'idempotent');
  assert.equal(store.records.length, 1);
});

test('rejects changed content for the same snapshot revision', async () => {
  const store = memoryStore();
  const original = validFixture();
  await importPortfolioSnapshot(store, original);
  const changed = structuredClone(original);
  const portfolio = changed.portfolio as Record<string, unknown>;
  portfolio.monthly_contribution = Number(portfolio.monthly_contribution) + 1;
  const changedWithFingerprint = withFingerprint(changed);
  await assert.rejects(
    () => importPortfolioSnapshot(store, changedWithFingerprint),
    PortfolioSnapshotRevisionConflictError
  );
});

test('rejects reuse of a fingerprint for a different snapshot revision', async () => {
  const store = memoryStore();
  const original = validFixture();
  const result = await importPortfolioSnapshot(store, original);
  assert.equal(result.status, 'created');
  const duplicateFingerprint = result.record.inputFingerprint;
  store.records.push({ ...result.record, snapshotId: 'other-snapshot', revision: 99, inputFingerprint: duplicateFingerprint });
  const candidate = withFingerprint({ ...original, snapshot_id: 'third-snapshot', revision: 2 });
  const candidateFingerprint = candidate.input_fingerprint as string;
  store.records[1] = { ...store.records[1], inputFingerprint: candidateFingerprint };
  await assert.rejects(
    () => importPortfolioSnapshot(store, candidate),
    PortfolioSnapshotFingerprintConflictError
  );
});

test('rejects invalid fingerprints before persistence lookup', async () => {
  const store = memoryStore();
  const invalid = { ...validFixture(), input_fingerprint: `sha256:${'0'.repeat(64)}` };
  await assert.rejects(() => importPortfolioSnapshot(store, invalid), /input_fingerprint mismatch/);
  assert.equal(store.records.length, 0);
});
