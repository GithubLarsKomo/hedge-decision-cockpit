import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  compareEtfMappingVersions,
  computeEtfMappingVersionComparisonFingerprint
} from './etf-mapping-version-comparison';

function candidate(id: string, overrides: Record<string, unknown> = {}) {
  return {
    instrument_id: id,
    exposure_fidelity: 0.99,
    ter: 0.0015,
    tracking_difference: -0.001,
    fund_size: 1_000_000_000,
    savings_plan_eligible: true,
    tradable: true,
    active_for_new_purchases: true,
    ...overrides
  };
}

function mapping(version: string, exposures: unknown[]) {
  return {
    schema_version: 'etf-nearest-neighbour-mapping/1.0',
    mapping_version: version,
    effective_date: '2026-08-01',
    exposures
  };
}

function exposure(id: string, selected: string, candidates: unknown[], desired = 'index') {
  return {
    exposure_id: id,
    desired_reference: desired,
    selected_instrument_id: selected,
    candidates
  };
}

describe('ETF mapping version comparison', () => {
  it('classifies unchanged, added and removed exposures deterministically', () => {
    const previous = mapping('2026-08', [
      exposure('equity', 'ETF-A', [candidate('ETF-A')]),
      exposure('bonds', 'ETF-B', [candidate('ETF-B')])
    ]);
    const next = mapping('2026-09', [
      exposure('equity', 'ETF-A', [candidate('ETF-A')]),
      exposure('gold', 'ETF-G', [candidate('ETF-G')])
    ]);

    const result = compareEtfMappingVersions(previous, next);
    assert.deepEqual(
      result.exposures.map((item) => [item.exposure_id, item.change]),
      [
        ['bonds', 'removed'],
        ['equity', 'unchanged'],
        ['gold', 'added']
      ]
    );
  });

  it('surfaces purchase-instrument changes and candidate deltas', () => {
    const previous = mapping('2026-08', [
      exposure('equity', 'ETF-A', [candidate('ETF-A'), candidate('ETF-B')])
    ]);
    const next = mapping('2026-09', [
      exposure('equity', 'ETF-C', [candidate('ETF-B', { ter: 0.001 }), candidate('ETF-C')])
    ]);

    const result = compareEtfMappingVersions(previous, next);
    const diff = result.exposures[0];
    assert.equal(diff.change, 'purchase_instrument_changed');
    assert.equal(diff.previous_selected_instrument_id, 'ETF-A');
    assert.equal(diff.next_selected_instrument_id, 'ETF-C');
    assert.deepEqual(diff.candidate_instruments_added, ['ETF-C']);
    assert.deepEqual(diff.candidate_instruments_removed, ['ETF-A']);
    assert.deepEqual(diff.candidate_instruments_changed, ['ETF-B']);
  });

  it('classifies candidate metadata or desired-reference changes without switching purchase instrument', () => {
    const previous = mapping('2026-08', [
      exposure('equity', 'ETF-A', [candidate('ETF-A')], 'MSCI World')
    ]);
    const next = mapping('2026-09', [
      exposure('equity', 'ETF-A', [candidate('ETF-A', { ter: 0.001 })], 'FTSE Developed')
    ]);

    const result = compareEtfMappingVersions(previous, next);
    assert.equal(result.exposures[0].change, 'candidate_set_changed');
    assert.deepEqual(result.exposures[0].candidate_instruments_changed, ['ETF-A']);
  });

  it('produces the same comparison and fingerprint independent of source ordering', () => {
    const previousA = mapping('2026-08', [
      exposure('b', 'ETF-B', [candidate('ETF-B')]),
      exposure('a', 'ETF-A', [candidate('ETF-C'), candidate('ETF-A')])
    ]);
    const previousB = mapping('2026-08', [
      exposure('a', 'ETF-A', [candidate('ETF-A'), candidate('ETF-C')]),
      exposure('b', 'ETF-B', [candidate('ETF-B')])
    ]);
    const next = mapping('2026-09', [
      exposure('a', 'ETF-C', [candidate('ETF-C'), candidate('ETF-A')]),
      exposure('b', 'ETF-B', [candidate('ETF-B')])
    ]);

    const left = compareEtfMappingVersions(previousA, next);
    const right = compareEtfMappingVersions(previousB, next);
    assert.deepEqual(left, right);
    assert.equal(
      computeEtfMappingVersionComparisonFingerprint(left),
      computeEtfMappingVersionComparisonFingerprint(right)
    );
  });

  it('rejects invalid mappings', () => {
    assert.throws(() => compareEtfMappingVersions({}, {}));
  });
});
