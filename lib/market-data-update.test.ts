import assert from 'node:assert/strict';
import test from 'node:test';
import { runMarketDataUpdateWithDependencies } from './market-data-update';

const syncResult = {
  source: 'fred:NASDAQ100+VIXCLS',
  observationStart: '2026-07-25',
  observationEnd: '2026-08-04',
  ndxFetched: 6,
  vixFetched: 6,
  eligible: 6,
  requested: 6,
  inserted: 1,
  skipped: 5
};

test('runs FRED sync and then creates a hedge decision', async () => {
  const calls: string[] = [];
  const result = await runMarketDataUpdateWithDependencies(
    { hedgeCoveragePercent: 0 },
    {
      async sync() {
        calls.push('sync');
        return syncResult;
      },
      async decide(options) {
        calls.push(`decide:${options.source}:${options.hedgeCoveragePercent}`);
        return {
          id: 4,
          created: true,
          input: {
            observedAt: '2026-08-03T00:00:00.000Z',
            source: syncResult.source,
            inputFingerprint: 'abc',
            ndxNow: 28776.8,
            ndxHigh2y: 30660.6,
            drawdownPercent: -6.14,
            vixNow: 15.86,
            vixPercentile: 22.6,
            hedgeCoveragePercent: 0,
            action: 'BUY_OR_ROLL_PUTS',
            severity: 'blue',
            recommendation: 'test',
            ruleVersion: '2.1.0',
            triggeredRules: ['NEAR_HIGH', 'VIX_CHEAP', 'HEDGE_UNDER_TARGET'],
            notes: null
          }
        };
      }
    }
  );

  assert.deepEqual(calls, ['sync', 'decide:fred:NASDAQ100+VIXCLS:0']);
  assert.equal(result.sync.inserted, 1);
  assert.deepEqual(result.decision, {
    id: 4,
    created: true,
    action: 'BUY_OR_ROLL_PUTS',
    severity: 'blue',
    ruleVersion: '2.1.0',
    inputFingerprint: 'abc'
  });
});

test('can update market data without creating a decision', async () => {
  let decisionCalled = false;
  const result = await runMarketDataUpdateWithDependencies(
    { createDecision: false },
    {
      async sync() {
        return syncResult;
      },
      async decide() {
        decisionCalled = true;
        throw new Error('must not run');
      }
    }
  );

  assert.equal(decisionCalled, false);
  assert.equal(result.decision, null);
});
