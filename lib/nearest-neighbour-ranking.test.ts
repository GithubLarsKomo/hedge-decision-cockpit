import assert from 'node:assert/strict';
import test from 'node:test';
import {
  rankNearestNeighbourCandidates,
  type NearestNeighbourCandidate,
  type NearestNeighbourScoringPolicy
} from './nearest-neighbour-ranking';

const policy: NearestNeighbourScoringPolicy = {
  version: 'nearest-neighbour/1.0',
  minimumExposureSimilarity: 0.8,
  maximumTrackingDifference: 0.02,
  maximumTer: 0.01,
  fundSizeReference: 1_000_000_000,
  switchMargin: 0.02,
  weights: {
    exposure: 0.55,
    tracking: 0.25,
    fundSize: 0.15,
    ter: 0.05
  }
};

const baseCandidates: NearestNeighbourCandidate[] = [
  {
    instrumentId: 'ETF-CLOSE',
    privatelyTradable: true,
    exposureSimilarity: 0.98,
    trackingDifference: 0.003,
    ter: 0.0035,
    fundSize: 700_000_000
  },
  {
    instrumentId: 'ETF-CHEAP',
    privatelyTradable: true,
    exposureSimilarity: 0.9,
    trackingDifference: 0.002,
    ter: 0.0015,
    fundSize: 900_000_000
  }
];

test('materially closer exposure wins despite a small TER disadvantage', () => {
  const result = rankNearestNeighbourCandidates(baseCandidates, policy);
  assert.equal(result.preferredInstrument, 'ETF-CLOSE');
  assert.equal(result.rankedCandidates[0]?.instrumentId, 'ETF-CLOSE');
  assert.ok((result.rankedCandidates[0]?.score ?? 0) > (result.rankedCandidates[1]?.score ?? 0));
});

test('lower TER alone does not trigger a switch below the configured margin', () => {
  const result = rankNearestNeighbourCandidates(
    [
      {
        instrumentId: 'ETF-ACTIVE',
        privatelyTradable: true,
        exposureSimilarity: 0.95,
        trackingDifference: 0.003,
        ter: 0.003,
        fundSize: 800_000_000,
        currentActive: true
      },
      {
        instrumentId: 'ETF-LOWER-TER',
        privatelyTradable: true,
        exposureSimilarity: 0.95,
        trackingDifference: 0.003,
        ter: 0.001,
        fundSize: 800_000_000
      }
    ],
    policy
  );

  assert.equal(result.preferredInstrument, 'ETF-LOWER-TER');
  assert.equal(result.currentActiveInstrument, 'ETF-ACTIVE');
  assert.equal(result.selectedInstrument, 'ETF-ACTIVE');
  assert.equal(result.switchRecommended, false);
});

test('rejects non-tradable and low-similarity candidates with explicit reasons', () => {
  const result = rankNearestNeighbourCandidates(
    [
      {
        instrumentId: 'ETF-NOT-TRADABLE',
        privatelyTradable: false,
        exposureSimilarity: 0.99,
        trackingDifference: 0.001,
        ter: 0.002,
        fundSize: 500_000_000
      },
      {
        instrumentId: 'ETF-WRONG-EXPOSURE',
        privatelyTradable: true,
        exposureSimilarity: 0.7,
        trackingDifference: 0.001,
        ter: 0.002,
        fundSize: 500_000_000
      }
    ],
    policy
  );

  assert.deepEqual(result.rejectedCandidates, [
    { instrumentId: 'ETF-NOT-TRADABLE', reasons: ['not_privately_tradable'] },
    { instrumentId: 'ETF-WRONG-EXPOSURE', reasons: ['exposure_similarity_below_minimum'] }
  ]);
  assert.equal(result.preferredInstrument, undefined);
});

test('ranking is deterministic across candidate input order', () => {
  const forward = rankNearestNeighbourCandidates(baseCandidates, policy);
  const reverse = rankNearestNeighbourCandidates([...baseCandidates].reverse(), policy);
  assert.deepEqual(forward, reverse);
});

test('uses instrument id as deterministic final tie breaker', () => {
  const candidate = {
    privatelyTradable: true,
    exposureSimilarity: 0.95,
    trackingDifference: 0.002,
    ter: 0.002,
    fundSize: 500_000_000
  };
  const result = rankNearestNeighbourCandidates(
    [
      { instrumentId: 'ETF-B', ...candidate },
      { instrumentId: 'ETF-A', ...candidate }
    ],
    policy
  );
  assert.deepEqual(result.rankedCandidates.map((row) => row.instrumentId), ['ETF-A', 'ETF-B']);
});

test('rejects invalid policies and duplicate candidates', () => {
  assert.throws(
    () => rankNearestNeighbourCandidates(baseCandidates, { ...policy, weights: { ...policy.weights, exposure: 0.5 } }),
    /weights must sum to one/
  );
  assert.throws(
    () => rankNearestNeighbourCandidates(baseCandidates, { ...policy, weights: { exposure: 0.2, tracking: 0.4, fundSize: 0.25, ter: 0.15 } }),
    /exposure weight must be the largest/
  );
  assert.throws(
    () => rankNearestNeighbourCandidates([baseCandidates[0], baseCandidates[0]], policy),
    /duplicate candidate instrument/
  );
});
