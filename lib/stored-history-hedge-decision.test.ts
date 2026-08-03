import assert from 'node:assert/strict';
import test from 'node:test';
import { DecisionConflictError } from './decision-persistence';
import type { DerivedHedgeSignals } from './market-signal-derivation';
import {
  buildStoredHistoryDecisionInput,
  runStoredHistoryHedgeDecisionWithDependencies
} from './stored-history-hedge-decision';

function signals(overrides: Partial<DerivedHedgeSignals> = {}): DerivedHedgeSignals {
  return {
    observedAt: '2026-08-03T20:00:00.000Z',
    ndxNow: 28000,
    ndxReferenceHigh: 28500,
    drawdownPercent: (28000 / 28500 - 1) * 100,
    vixNow: 14,
    vixPercentile: 20,
    ndxObservationCount: 500,
    vixObservationCount: 500,
    decisionInput: {
      drawdownPercent: (28000 / 28500 - 1) * 100,
      vixPercentile: 20,
      hedgeCoveragePercent: 75
    },
    ...overrides
  };
}

test('builds a canonical decision using the existing hedge rule engine', () => {
  const input = buildStoredHistoryDecisionInput(signals(), 'nasdaq-fred-daily');
  assert.equal(input.action, 'BUY_OR_ROLL_PUTS');
  assert.equal(input.severity, 'blue');
  assert.deepEqual(input.triggeredRules, ['NEAR_HIGH', 'VIX_CHEAP', 'HEDGE_UNDER_TARGET']);
  assert.equal(input.ruleVersion, '2.1.0');
  assert.equal(input.ndxHigh2y, 28500);
  assert.match(input.inputFingerprint!, /^[a-f0-9]{64}$/);
});

test('decision fingerprint is stable for identical history signals and changes with coverage', () => {
  const first = buildStoredHistoryDecisionInput(signals(), 'source-a');
  const replay = buildStoredHistoryDecisionInput(signals(), 'source-a');
  const changed = buildStoredHistoryDecisionInput(signals({
    decisionInput: {
      drawdownPercent: (28000 / 28500 - 1) * 100,
      vixPercentile: 20,
      hedgeCoveragePercent: 100
    }
  }), 'source-a');
  assert.equal(first.inputFingerprint, replay.inputFingerprint);
  assert.notEqual(first.inputFingerprint, changed.inputFingerprint);
});

test('runner persists a new decision and normalizes the requested source/as-of', async () => {
  let derivedOptions: unknown;
  let persistedInput: unknown;
  const result = await runStoredHistoryHedgeDecisionWithDependencies({
    source: '  source-a  ',
    asOf: '2026-08-03T20:00:00Z',
    hedgeCoveragePercent: 75
  }, {
    async deriveSignals(options) {
      derivedOptions = options;
      return signals();
    },
    async persist(input) {
      persistedInput = input;
      return { id: 42, input };
    },
    async findByFingerprint() {
      throw new Error('should not look up a new decision');
    }
  });

  assert.deepEqual(derivedOptions, {
    source: 'source-a',
    asOf: '2026-08-03T20:00:00.000Z',
    hedgeCoveragePercent: 75
  });
  assert.equal((persistedInput as { source: string }).source, 'source-a');
  assert.equal(result.id, 42);
  assert.equal(result.created, true);
});

test('runner reports deterministic duplicate replay as unchanged', async () => {
  let lookedUpFingerprint = '';
  const result = await runStoredHistoryHedgeDecisionWithDependencies({ source: 'source-a' }, {
    async deriveSignals() {
      return signals();
    },
    async persist() {
      throw new DecisionConflictError();
    },
    async findByFingerprint(inputFingerprint) {
      lookedUpFingerprint = inputFingerprint;
      return { id: 7 };
    }
  });

  assert.equal(result.created, false);
  assert.equal(result.id, 7);
  assert.equal(lookedUpFingerprint, result.input.inputFingerprint);
});

test('runner rejects invalid source and hedge coverage before derivation', async () => {
  let derived = false;
  const dependencies = {
    async deriveSignals() { derived = true; return signals(); },
    async persist(input: ReturnType<typeof buildStoredHistoryDecisionInput>) { return { id: 1, input }; },
    async findByFingerprint() { return null; }
  };

  await assert.rejects(
    () => runStoredHistoryHedgeDecisionWithDependencies({ source: '   ' }, dependencies),
    /Market data source is required/
  );
  await assert.rejects(
    () => runStoredHistoryHedgeDecisionWithDependencies({ source: 'x', hedgeCoveragePercent: -1 }, dependencies),
    /between 0 and 1000/
  );
  assert.equal(derived, false);
});
