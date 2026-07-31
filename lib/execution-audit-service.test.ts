import assert from 'node:assert/strict';
import test from 'node:test';
import type { ExecutionAuditPersistenceData } from './execution-audit-persistence';
import {
  DecisionNotFoundError,
  ExecutionAuditAlreadyExistsError,
  saveExecutionAuditRecord,
  type ExecutionAuditStore
} from './execution-audit-service';

function input() {
  return {
    decisionId: 42,
    audit: {
      recommendationId: 'decision-123',
      recommendedStrategy: 'LONG_PUT',
      recommendedContracts: 8,
      decidedAt: '2026-07-30T08:00:00.000Z',
      approval: {
        decision: 'APPROVED' as const,
        actorId: 'risk-owner-1',
        recordedAt: '2026-07-30T08:05:00.000Z'
      },
      execution: {
        status: 'EXECUTED' as const,
        actorId: 'trader-1',
        recordedAt: '2026-07-30T08:10:00.000Z',
        executedStrategy: 'LONG_PUT',
        executedContracts: 8,
        averagePrice: 123.45
      }
    }
  };
}

function store(overrides: Partial<ExecutionAuditStore> = {}): ExecutionAuditStore {
  return {
    decisionExists: async () => true,
    findByDecisionId: async () => null,
    create: async (data) => data,
    ...overrides
  };
}

test('validates, maps and persists an execution audit record', async () => {
  let created: ExecutionAuditPersistenceData | undefined;
  const result = await saveExecutionAuditRecord(
    store({
      create: async (data) => {
        created = data;
        return data;
      }
    }),
    input()
  );

  assert.equal(created?.decisionId, 42);
  assert.equal(result.record.deviation.notFullyExecuted, false);
  assert.equal(result.persisted.recommendationId, 'decision-123');
});

test('rejects audits for missing decisions before writing', async () => {
  let writes = 0;
  await assert.rejects(
    saveExecutionAuditRecord(
      store({
        decisionExists: async () => false,
        create: async (data) => {
          writes += 1;
          return data;
        }
      }),
      input()
    ),
    DecisionNotFoundError
  );
  assert.equal(writes, 0);
});

test('prevents a second audit record for the same decision', async () => {
  const existing = { decisionId: 42 } as ExecutionAuditPersistenceData;
  await assert.rejects(
    saveExecutionAuditRecord(store({ findByDecisionId: async () => existing }), input()),
    ExecutionAuditAlreadyExistsError
  );
});

test('validates the domain record before store access', async () => {
  let reads = 0;
  const invalid = input();
  invalid.audit.approval.actorId = '   ';

  await assert.rejects(
    saveExecutionAuditRecord(
      store({
        decisionExists: async () => {
          reads += 1;
          return true;
        }
      }),
      invalid
    ),
    /approval.actorId/
  );
  assert.equal(reads, 0);
});
