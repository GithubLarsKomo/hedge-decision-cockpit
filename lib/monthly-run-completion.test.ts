import assert from 'node:assert/strict';
import test from 'node:test';
import { computeMonthlyRunCompletionFingerprint } from './monthly-run-completion';

const base = {
  snapshot_fingerprint: `sha256:${'1'.repeat(64)}`,
  decision_id: 42,
  mapping_review_fingerprint: `sha256:${'2'.repeat(64)}`,
  actor: 'operator',
  rationale: 'Reviewed monthly run and accepted the recorded recommendation.',
  completed_at: '2026-08-03T08:00:00.000Z'
};

test('monthly completion fingerprint is deterministic across replay timestamps', () => {
  const first = computeMonthlyRunCompletionFingerprint(base);
  const replay = computeMonthlyRunCompletionFingerprint({ ...base, completed_at: '2026-08-03T09:00:00.000Z' });
  assert.equal(first, replay);
});

test('monthly completion fingerprint changes when bound decision changes', () => {
  assert.notEqual(
    computeMonthlyRunCompletionFingerprint(base),
    computeMonthlyRunCompletionFingerprint({ ...base, decision_id: 43 })
  );
});
