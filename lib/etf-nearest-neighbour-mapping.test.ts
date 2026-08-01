import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  applyEtfNearestNeighbourMapping,
  computeEtfMappingFingerprint,
  rankEtfCandidates,
  validateEtfNearestNeighbourMapping
} from './etf-nearest-neighbour-mapping';
import { generatePortfolioSnapshot, type MonthlyPortfolioInput } from './portfolio-snapshot-generator';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), path), 'utf8'));
}

describe('ETF nearest-neighbour mapping', () => {
  it('validates and fingerprints mapping deterministically', () => {
    const mapping = validateEtfNearestNeighbourMapping(readJson('fixtures/etf-mapping/2026-08.json'));
    const first = computeEtfMappingFingerprint(mapping);
    const second = computeEtfMappingFingerprint(JSON.parse(JSON.stringify(mapping)));

    assert.equal(first, second);
    assert.match(first, /^sha256:[a-f0-9]{64}$/);
  });

  it('ranks higher exposure fidelity above marginally lower TER', () => {
    const mapping = validateEtfNearestNeighbourMapping(readJson('fixtures/etf-mapping/2026-08.json'));
    const ranked = rankEtfCandidates(mapping.exposures[0].candidates);

    assert.equal(ranked[0].instrument_id, 'IE00BETTERFIT1');
    assert.ok(ranked[0].score > ranked[1].score);
  });

  it('changes fingerprint when candidate semantics change', () => {
    const mapping = validateEtfNearestNeighbourMapping(readJson('fixtures/etf-mapping/2026-08.json'));
    const changed = {
      ...mapping,
      exposures: mapping.exposures.map((exposure) => ({
        ...exposure,
        candidates: exposure.candidates.map((candidate, index) => index === 0 ? { ...candidate, ter: candidate.ter + 0.0001 } : candidate)
      }))
    };

    assert.notEqual(computeEtfMappingFingerprint(mapping), computeEtfMappingFingerprint(changed));
  });

  it('rejects an untradable selected candidate', () => {
    const raw = readJson('fixtures/etf-mapping/2026-08.json') as {
      exposures: Array<{ candidates: Array<{ tradable: boolean }> }>;
    };
    raw.exposures[0].candidates[1].tradable = false;
    assert.throws(() => validateEtfNearestNeighbourMapping(raw));
  });

  it('applies mapping while preserving legacy mapped instruments', () => {
    const input = readJson('fixtures/portfolio-snapshot/monthly-input.json') as MonthlyPortfolioInput;
    const mapping = validateEtfNearestNeighbourMapping(readJson('fixtures/etf-mapping/2026-08.json'));
    const applied = applyEtfNearestNeighbourMapping(input, mapping);

    assert.equal(applied.exposures[0].active_purchase_instrument, 'IE00BETTERFIT1');
    assert.equal(applied.exposures[0].mapping_version, '2026-08');
    assert.ok(applied.exposures[0].mapped_instruments.includes('IE00LEGACY01'));
    assert.doesNotThrow(() => generatePortfolioSnapshot(applied));
  });
});
