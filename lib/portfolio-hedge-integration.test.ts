import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { RULE_VERSION } from './decision-engine';
import { evaluatePortfolioHedgeDecision } from './portfolio-hedge-integration';

function validSnapshot(): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(process.cwd(), 'fixtures', 'portfolio-snapshot', 'valid.json'), 'utf8')
  ) as Record<string, unknown>;
}

test('evaluates a hedge decision from the canonical portfolio export without execution semantics', () => {
  const snapshot = validSnapshot() as { input_fingerprint: string; snapshot_id: string; revision: number };
  const result = evaluatePortfolioHedgeDecision(snapshot, {
    drawdownPercent: -5,
    vixPercentile: 20,
    hedgeCoveragePercent: 50
  });

  assert.equal(result.snapshot.snapshotId, snapshot.snapshot_id);
  assert.equal(result.snapshot.revision, snapshot.revision);
  assert.equal(result.snapshot.inputFingerprint, snapshot.input_fingerprint);
  assert.equal(result.hedgeDecision.action, 'BUY_OR_ROLL_PUTS');
  assert.equal(result.hedgeDecision.ruleVersion, RULE_VERSION);
  assert.deepEqual(result.hedgeDecision.triggeredRules, ['NEAR_HIGH', 'VIX_CHEAP', 'HEDGE_UNDER_TARGET']);
  assert.equal('order' in result, false);
  assert.equal('execution' in result, false);
});

test('rejects an invalid portfolio snapshot before hedge evaluation', () => {
  const snapshot = validSnapshot();
  snapshot.input_fingerprint = `sha256:${'0'.repeat(64)}`;

  assert.throws(
    () => evaluatePortfolioHedgeDecision(snapshot, { drawdownPercent: -5, vixPercentile: 20 }),
    /input_fingerprint mismatch/
  );
});

test('rejects invalid tactical inputs explicitly', () => {
  const snapshot = validSnapshot();
  assert.throws(
    () => evaluatePortfolioHedgeDecision(snapshot, { drawdownPercent: -5, vixPercentile: 101 }),
    /vixPercentile/
  );
});
