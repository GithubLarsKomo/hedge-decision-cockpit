import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExecutionAuditRecord } from './execution-audit-record';
import { mapExecutionAuditRecordToPersistence } from './execution-audit-persistence';

function record() {
  return buildExecutionAuditRecord({
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
      status: 'PARTIALLY_EXECUTED',
      actorId: 'trader-1',
      recordedAt: '2026-07-30T08:10:00.000Z',
      executedStrategy: 'LONG_PUT',
      executedContracts: 5,
      averagePrice: 123.45,
      deviationReason: 'Only five contracts were available inside the limit.'
    }
  });
}

test('maps a validated audit record to flat Prisma persistence data', () => {
  const data = mapExecutionAuditRecordToPersistence(42, record());

  assert.equal(data.decisionId, 42);
  assert.equal(data.recommendationId, 'decision-123');
  assert.equal(data.approvalDecision, 'APPROVED');
  assert.equal(data.executionStatus, 'PARTIALLY_EXECUTED');
  assert.equal(data.executedContracts, 5);
  assert.equal(data.contractQuantityChanged, true);
  assert.equal(data.notFullyExecuted, true);
  assert.equal(data.decidedAt.toISOString(), '2026-07-30T08:00:00.000Z');
  assert.equal(data.approvalRecordedAt.toISOString(), '2026-07-30T08:05:00.000Z');
  assert.equal(data.executionRecordedAt?.toISOString(), '2026-07-30T08:10:00.000Z');
});

test('rejects invalid decision identifiers', () => {
  assert.throws(() => mapExecutionAuditRecordToPersistence(0, record()), /positive integer/);
  assert.throws(() => mapExecutionAuditRecordToPersistence(1.5, record()), /positive integer/);
});
