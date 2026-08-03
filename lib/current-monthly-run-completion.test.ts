import assert from 'node:assert/strict';
import test from 'node:test';

type CompletionIdentity = {
  snapshotFingerprint: string;
  decisionId: number;
};

function matchesCurrentRun(completion: CompletionIdentity, snapshotFingerprint: string, decisionId: number) {
  return completion.snapshotFingerprint === snapshotFingerprint && completion.decisionId === decisionId;
}

test('completion only matches the exact current snapshot and decision', () => {
  const completion = { snapshotFingerprint: 'sha256:abc', decisionId: 42 };
  assert.equal(matchesCurrentRun(completion, 'sha256:abc', 42), true);
  assert.equal(matchesCurrentRun(completion, 'sha256:new', 42), false);
  assert.equal(matchesCurrentRun(completion, 'sha256:abc', 43), false);
});
