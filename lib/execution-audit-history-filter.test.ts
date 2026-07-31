import assert from 'node:assert/strict';
import test from 'node:test';
import { filterExecutionAuditHistory } from './execution-audit-history-filter';

const decisions = [
  { id: 1, executionAudit: null },
  { id: 2, executionAudit: { approvalDecision: 'APPROVED', executionStatus: 'EXECUTED', strategyChanged: false, contractQuantityChanged: false, notFullyExecuted: false } },
  { id: 3, executionAudit: { approvalDecision: 'APPROVED', executionStatus: 'PARTIALLY_EXECUTED', strategyChanged: false, contractQuantityChanged: true, notFullyExecuted: true } },
  { id: 4, executionAudit: { approvalDecision: 'REJECTED', executionStatus: 'NOT_EXECUTED', strategyChanged: false, contractQuantityChanged: false, notFullyExecuted: true } }
];

test('omits decisions without audit records', () => {
  const result = filterExecutionAuditHistory(decisions, { approval: 'ALL', execution: 'ALL', deviation: 'ALL' });
  assert.deepEqual(result.map(item => item.id), [2, 3, 4]);
});

test('combines approval, execution and deviation filters', () => {
  const result = filterExecutionAuditHistory(decisions, { approval: 'APPROVED', execution: 'PARTIALLY_EXECUTED', deviation: 'WITH_DEVIATION' });
  assert.deepEqual(result.map(item => item.id), [3]);
});

test('selects records without deviations', () => {
  const result = filterExecutionAuditHistory(decisions, { approval: 'ALL', execution: 'ALL', deviation: 'WITHOUT_DEVIATION' });
  assert.deepEqual(result.map(item => item.id), [2]);
});
