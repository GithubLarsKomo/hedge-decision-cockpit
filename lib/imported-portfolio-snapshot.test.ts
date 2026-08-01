import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, beforeEach, describe, it } from 'node:test';
import { prisma } from './prisma';
import {
  importPortfolioSnapshot,
  PortfolioSnapshotConflictError
} from './imported-portfolio-snapshot';
import { computePortfolioSnapshotFingerprint } from './portfolio-snapshot';

function validFixture(): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(process.cwd(), 'fixtures', 'portfolio-snapshot', 'valid.json'), 'utf8')
  ) as Record<string, unknown>;
}

function withFingerprint(value: Record<string, unknown>): Record<string, unknown> {
  return { ...value, input_fingerprint: computePortfolioSnapshotFingerprint(value) };
}

beforeEach(async () => {
  await prisma.importedPortfolioSnapshot.deleteMany();
});

after(async () => {
  await prisma.importedPortfolioSnapshot.deleteMany();
  await prisma.$disconnect();
});

describe('imported portfolio snapshot persistence', () => {
  it('persists a valid snapshot and returns the same row for an identical retry', async () => {
    const snapshot = validFixture();
    const first = await importPortfolioSnapshot(snapshot);
    const second = await importPortfolioSnapshot(snapshot);

    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.id, first.id);
    assert.equal(await prisma.importedPortfolioSnapshot.count(), 1);
  });

  it('rejects conflicting content for the same snapshot revision', async () => {
    const snapshot = validFixture();
    await importPortfolioSnapshot(snapshot);

    const changed = structuredClone(snapshot);
    const portfolio = changed.portfolio as Record<string, unknown>;
    portfolio.market_value = 251000;
    const conflicting = withFingerprint(changed);

    await assert.rejects(
      () => importPortfolioSnapshot(conflicting),
      (error: unknown) => error instanceof PortfolioSnapshotConflictError
    );
    assert.equal(await prisma.importedPortfolioSnapshot.count(), 1);
  });

  it('allows a higher revision for the same logical snapshot', async () => {
    const snapshot = validFixture();
    await importPortfolioSnapshot(snapshot);

    const revised = structuredClone(snapshot);
    revised.revision = 2;
    const revisionTwo = withFingerprint(revised);
    const result = await importPortfolioSnapshot(revisionTwo);

    assert.equal(result.created, true);
    assert.equal(result.revision, 2);
    assert.equal(await prisma.importedPortfolioSnapshot.count(), 2);
  });

  it('rejects an invalid fingerprint before persistence', async () => {
    const snapshot = validFixture();
    snapshot.input_fingerprint = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';

    await assert.rejects(() => importPortfolioSnapshot(snapshot), /input_fingerprint mismatch/);
    assert.equal(await prisma.importedPortfolioSnapshot.count(), 0);
  });
});
