import assert from 'node:assert/strict';
import test from 'node:test';
import { executionAuditInputSchema } from './execution-audit-schema';

const validPayload = {
  recommendationId: 'rec-1',
  recommendedStrategy: 'LONG_PUT',
  recommendedContracts: 4,
  decidedAt: '2026-07-31T07:00:00.000Z',
  approval: {
    decision: 'APPROVED',
    actorId: 'risk-owner',
    recordedAt: '2026-07-31T07:05:00.000Z'
  },
  execution: {
    status: 'EXECUTED',
    actorId: 'trader',
    recordedAt: '2026-07-31T07:10:00.000Z',
    executedStrategy: 'LONG_PUT',
    executedContracts: 4,
    averagePrice: 123.45
  }
};

test('accepts a structurally valid execution audit request', () => {
  assert.equal(executionAuditInputSchema.safeParse(validPayload).success, true);
});

test('rejects invalid enums, timestamps and quantities', () => {
  const result = executionAuditInputSchema.safeParse({
    ...validPayload,
    recommendedContracts: -1,
    decidedAt: 'not-a-date',
    approval: { ...validPayload.approval, decision: 'PENDING' }
  });

  assert.equal(result.success, false);
});
