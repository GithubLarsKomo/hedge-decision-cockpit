import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExecutionAuditRequest, type ExecutionAuditFormValues } from './execution-audit-form';

function values(): ExecutionAuditFormValues {
  return {
    recommendationId: ' rec-1 ',
    recommendedStrategy: ' LONG_PUT ',
    recommendedContracts: '8',
    decidedAt: '2026-07-31T08:00',
    approvalDecision: 'APPROVED',
    approvalActorId: ' owner-1 ',
    approvalRecordedAt: '2026-07-31T08:05',
    approvalReason: '',
    executionStatus: 'EXECUTED',
    executionActorId: ' trader-1 ',
    executionRecordedAt: '2026-07-31T08:10',
    executedStrategy: ' LONG_PUT ',
    executedContracts: '8',
    averagePrice: '123.45',
    deviationReason: ''
  };
}

test('builds a normalized executed request', () => {
  const request = buildExecutionAuditRequest(values());
  assert.equal(request.recommendationId, 'rec-1');
  assert.equal(request.recommendedContracts, 8);
  assert.equal(request.execution.executedContracts, 8);
  assert.equal(request.execution.averagePrice, 123.45);
  assert.match(request.decidedAt, /Z$/);
});

test('omits execution details when nothing was executed', () => {
  const input = values();
  input.executionStatus = 'NOT_EXECUTED';
  input.executionActorId = '';
  input.executionRecordedAt = '';
  input.executedStrategy = '';
  input.executedContracts = '';
  input.averagePrice = '';
  input.deviationReason = 'Order was not placed.';

  const request = buildExecutionAuditRequest(input);
  assert.deepEqual(request.execution, {
    status: 'NOT_EXECUTED',
    deviationReason: 'Order was not placed.'
  });
});

test('rejects invalid numeric values before submission', () => {
  const input = values();
  input.recommendedContracts = '2.5';
  assert.throws(() => buildExecutionAuditRequest(input), /non-negative integer/);
});
