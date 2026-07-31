import type { ExecutionAuditPersistenceData } from './execution-audit-persistence';
import type { ExecutionAuditStore } from './execution-audit-service';

type DecisionDelegate = {
  findUnique(args: { where: { id: number }; select: { id: true } }): Promise<{ id: number } | null>;
};

type ExecutionAuditDelegate = {
  findUnique(args: { where: { decisionId: number } }): Promise<ExecutionAuditPersistenceData | null>;
  create(args: { data: ExecutionAuditPersistenceData }): Promise<ExecutionAuditPersistenceData>;
};

export type ExecutionAuditPrismaClient = {
  decision: DecisionDelegate;
  executionAuditRecord: ExecutionAuditDelegate;
};

export function createPrismaExecutionAuditStore(client: ExecutionAuditPrismaClient): ExecutionAuditStore {
  return {
    async decisionExists(decisionId) {
      return (await client.decision.findUnique({ where: { id: decisionId }, select: { id: true } })) !== null;
    },

    findByDecisionId(decisionId) {
      return client.executionAuditRecord.findUnique({ where: { decisionId } });
    },

    create(data) {
      return client.executionAuditRecord.create({ data });
    }
  };
}
