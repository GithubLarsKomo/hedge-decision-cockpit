import assert from 'node:assert/strict';
import test from 'node:test';
import type { ExecutionAuditPersistenceData } from './execution-audit-persistence';
import { createPrismaExecutionAuditStore, type ExecutionAuditPrismaClient } from './prisma-execution-audit-store';

const data: ExecutionAuditPersistenceData = {
  decisionId: 7,
  recommendationId: 'decision-7',
  recommendedStrategy: 'LONG_PUT',
  recommendedContracts: 4,
  decidedAt: new Date('2026-07-31T06:00:00.000Z'),
  approvalDecision: 'APPROVED',
  approvalActorId: 'risk-owner',
  approvalRecordedAt: new Date('2026-07-31T06:05:00.000Z'),
  executionStatus: 'EXECUTED',
  executionActorId: 'trader',
  executionRecordedAt: new Date('2026-07-31T06:10:00.000Z'),
  executedStrategy: 'LONG_PUT',
  executedContracts: 4,
  averagePrice: 101.25,
  strategyChanged: false,
  contractQuantityChanged: false,
  notFullyExecuted: false
};

test('maps store operations to the expected Prisma delegates', async () => {
  const calls: unknown[] = [];
  const client: ExecutionAuditPrismaClient = {
    decision: {
      async findUnique(args) {
        calls.push(['decision.findUnique', args]);
        return { id: 7 };
      }
    },
    executionAuditRecord: {
      async findUnique(args) {
        calls.push(['executionAuditRecord.findUnique', args]);
        return data;
      },
      async create(args) {
        calls.push(['executionAuditRecord.create', args]);
        return args.data;
      }
    }
  };

  const store = createPrismaExecutionAuditStore(client);
  assert.equal(await store.decisionExists(7), true);
  assert.equal(await store.findByDecisionId(7), data);
  assert.equal(await store.create(data), data);

  assert.deepEqual(calls, [
    ['decision.findUnique', { where: { id: 7 }, select: { id: true } }],
    ['executionAuditRecord.findUnique', { where: { decisionId: 7 } }],
    ['executionAuditRecord.create', { data }]
  ]);
});

test('returns false when Prisma cannot find the decision', async () => {
  const client: ExecutionAuditPrismaClient = {
    decision: { async findUnique() { return null; } },
    executionAuditRecord: {
      async findUnique() { return null; },
      async create(args) { return args.data; }
    }
  };

  const store = createPrismaExecutionAuditStore(client);
  assert.equal(await store.decisionExists(999), false);
});
