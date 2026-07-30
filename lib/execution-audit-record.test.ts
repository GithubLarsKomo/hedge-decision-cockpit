import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExecutionAuditRecord, ExecutionAuditInput } from './execution-audit-record';

function validInput(): ExecutionAuditInput {
  return {
    recommendationId: 'decision-123',
    recommendedStrategy: 'LONG_PUT',
    recommendedContracts: 8,
    decidedAt: '2026-07-30T08:00:00.000Z',
    approval: {
      decision: 'APPROVED',
      actorId: 'risk-owner-1',
      recordedAt: '2026-07-30T08:05:00.000Z'
    },
    execution: {
      status: 'EXECUTED',
      actorId: 'trader-1',
      recordedAt: '2026-07-30T08:10:00.000Z',
      executedStrategy: 'LONG_PUT',
      executedContracts: 8,
      averagePrice: 123.45
    }
  };
}

test('records an approved execution without deviation', () => {
  const record = buildExecutionAuditRecord(validInput());

  assert.deepEqual(record.deviation, {
    strategyChanged: false,
    contractQuantityChanged: false,
    notFullyExecuted: false,
    reason: undefined
  });
});

test('requires a reason for partial, omitted or changed execution', () => {
  const partial = validInput();
  partial.execution.status = 'PARTIALLY_EXECUTED';
  partial.execution.executedContracts = 5;

  assert.throws(() => buildExecutionAuditRecord(partial), /deviation reason/);

  partial.execution.deviationReason = 'Only five contracts were available inside the limit.';
  const record = buildExecutionAuditRecord(partial);
  assert.equal(record.deviation.contractQuantityChanged, true);
  assert.equal(record.deviation.notFullyExecuted, true);
});

test('requires a reason for rejected recommendations and prevents execution', () => {
  const rejected = validInput();
  rejected.approval.decision = 'REJECTED';
  rejected.execution = { status: 'NOT_EXECUTED', deviationReason: 'Risk owner rejected the recommendation.' };

  assert.throws(() => buildExecutionAuditRecord(rejected), /approval reason/);

  rejected.approval.reason = 'Risk budget was unavailable.';
  const record = buildExecutionAuditRecord(rejected);
  assert.equal(record.deviation.notFullyExecuted, true);
});

test('enforces approval and execution chronology', () => {
  const approvalBeforeDecision = validInput();
  approvalBeforeDecision.approval.recordedAt = '2026-07-30T07:59:00.000Z';
  assert.throws(() => buildExecutionAuditRecord(approvalBeforeDecision), /must not precede/);

  const executionBeforeApproval = validInput();
  executionBeforeApproval.execution.recordedAt = '2026-07-30T08:04:00.000Z';
  assert.throws(() => buildExecutionAuditRecord(executionBeforeApproval), /must not precede approval/);
});

test('rejects execution details when no execution occurred', () => {
  const input = validInput();
  input.execution = {
    status: 'NOT_EXECUTED',
    actorId: 'trader-1',
    deviationReason: 'Order was not placed.'
  };

  assert.throws(() => buildExecutionAuditRecord(input), /must not contain execution details/);
});
