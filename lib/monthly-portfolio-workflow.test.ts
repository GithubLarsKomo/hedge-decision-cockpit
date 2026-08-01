import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, it } from 'node:test';
import { prisma } from './prisma';
import { runMonthlyPortfolioWorkflow } from './monthly-portfolio-workflow';
import type { MonthlyPortfolioInput } from './portfolio-snapshot-generator';

function exampleInput(): MonthlyPortfolioInput {
  return JSON.parse(
    readFileSync(join(process.cwd(), 'fixtures', 'portfolio-snapshot', 'monthly-input.json'), 'utf8')
  ) as MonthlyPortfolioInput;
}

describe('monthly portfolio workflow', () => {
  beforeEach(async () => {
    await prisma.importedPortfolioSnapshot.deleteMany();
  });

  it('generates, persists and allocates one monthly snapshot', async () => {
    const result = await runMonthlyPortfolioWorkflow(exampleInput());
    assert.equal(result.import.created, true);
    assert.equal(result.import.snapshotId, result.snapshot.snapshot_id);
    assert.equal(result.import.inputFingerprint, result.snapshot.input_fingerprint);
    assert.equal(result.allocation.currency, result.snapshot.portfolio.currency);
    assert.equal(
      result.allocation.allocatedContribution + result.allocation.residualContribution,
      result.allocation.monthlyContribution
    );
  });

  it('is idempotent when the same monthly input is run twice', async () => {
    const first = await runMonthlyPortfolioWorkflow(exampleInput());
    const second = await runMonthlyPortfolioWorkflow(exampleInput());
    assert.equal(first.import.created, true);
    assert.equal(second.import.created, false);
    assert.equal(second.import.id, first.import.id);
    assert.equal(second.snapshot.input_fingerprint, first.snapshot.input_fingerprint);
    assert.deepEqual(second.allocation, first.allocation);
  });
});
