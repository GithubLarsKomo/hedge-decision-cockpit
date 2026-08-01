import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  applyGpoTargetAllocation,
  computeGpoTargetAllocationFingerprint,
  validateGpoTargetAllocation
} from './gpo-target-allocation';
import { generatePortfolioSnapshot, type MonthlyPortfolioInput } from './portfolio-snapshot-generator';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), path), 'utf8'));
}

describe('GPO target allocation contract', () => {
  it('validates and fingerprints a monthly target allocation deterministically', () => {
    const raw = readJson('fixtures/gpo-target-allocation/2026-08.json');
    const allocation = validateGpoTargetAllocation(raw);
    const first = computeGpoTargetAllocationFingerprint(allocation);
    const second = computeGpoTargetAllocationFingerprint(JSON.parse(JSON.stringify(allocation)));

    assert.equal(first, second);
    assert.match(first, /^[a-f0-9]{64}$/);
  });

  it('changes the fingerprint when a semantic target changes', () => {
    const allocation = validateGpoTargetAllocation(readJson('fixtures/gpo-target-allocation/2026-08.json'));
    const changed = {
      ...allocation,
      exposures: allocation.exposures.map((exposure) => ({ ...exposure, target_weight: 0.99 }))
    };

    assert.notEqual(
      computeGpoTargetAllocationFingerprint(allocation),
      computeGpoTargetAllocationFingerprint(changed)
    );
  });

  it('rejects totals that do not equal one', () => {
    const raw = readJson('fixtures/gpo-target-allocation/2026-08.json') as Record<string, unknown>;
    const exposures = raw.exposures as Array<Record<string, unknown>>;

    assert.throws(() => validateGpoTargetAllocation({
      ...raw,
      exposures: exposures.map((exposure) => ({ ...exposure, target_weight: 0.8 }))
    }));
  });

  it('applies target weights without changing current holdings or instrument mappings', () => {
    const input = readJson('fixtures/portfolio-snapshot/monthly-input.json') as MonthlyPortfolioInput;
    const allocation = validateGpoTargetAllocation(readJson('fixtures/gpo-target-allocation/2026-08.json'));
    const applied = applyGpoTargetAllocation(input, allocation);

    assert.equal(applied.exposures[0].target_weight, 1);
    assert.equal(applied.exposures[0].current_weight, input.exposures[0].current_weight);
    assert.deepEqual(applied.exposures[0].mapped_instruments, input.exposures[0].mapped_instruments);
    assert.equal(applied.strategy.source_observation_date, allocation.source_observation_date);
    assert.equal(applied.strategy.confidence, allocation.confidence);
    assert.doesNotThrow(() => generatePortfolioSnapshot(applied));
  });

  it('rejects allocation/input exposure mismatches', () => {
    const input = readJson('fixtures/portfolio-snapshot/monthly-input.json') as MonthlyPortfolioInput;
    const allocation = validateGpoTargetAllocation(readJson('fixtures/gpo-target-allocation/2026-08.json'));

    assert.throws(() => applyGpoTargetAllocation({
      ...input,
      exposures: [{ ...input.exposures[0], exposure_id: 'different-exposure' }]
    }, allocation));
  });
});
