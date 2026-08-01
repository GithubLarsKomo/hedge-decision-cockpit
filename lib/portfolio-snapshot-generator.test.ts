import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, it } from 'node:test';
import { prisma } from './prisma';
import { importPortfolioSnapshot } from './imported-portfolio-snapshot';
import { generatePortfolioSnapshot } from './portfolio-snapshot-generator';
import { validatePortfolioSnapshot } from './portfolio-snapshot';

function exampleInput(): unknown {
  return JSON.parse(
    readFileSync(join(process.cwd(), 'fixtures', 'portfolio-snapshot', 'monthly-input.json'), 'utf8')
  );
}

describe('monthly portfolio snapshot generator', () => {
  beforeEach(async () => {
    await prisma.importedPortfolioSnapshot.deleteMany();
  });

  it('generates a valid deterministic snapshot from local input', () => {
    const first = generatePortfolioSnapshot(exampleInput());
    const second = generatePortfolioSnapshot(exampleInput());
    assert.equal(first.input_fingerprint, second.input_fingerprint);
    assert.equal(validatePortfolioSnapshot(first).snapshot_id, '2026-08');
  });

  it('feeds the generated snapshot directly into the import path', async () => {
    const snapshot = generatePortfolioSnapshot(exampleInput());
    const result = await importPortfolioSnapshot(snapshot);
    assert.equal(result.created, true);
    assert.equal(result.snapshotId, snapshot.snapshot_id);
    assert.equal(result.inputFingerprint, snapshot.input_fingerprint);
  });

  it('rejects malformed local input before generating a fingerprint', () => {
    const input = exampleInput() as Record<string, unknown>;
    delete input.strategy;
    assert.throws(() => generatePortfolioSnapshot(input));
  });

  it('rejects a pre-supplied input_fingerprint in local input', () => {
    const input = exampleInput() as Record<string, unknown>;
    input.input_fingerprint = `sha256:${'0'.repeat(64)}`;
    assert.throws(() => generatePortfolioSnapshot(input));
  });
});
