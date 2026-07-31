import type { ExecutionAuditInput, ExecutionAuditRecord } from './execution-audit-record';
import { buildExecutionAuditRecord } from './execution-audit-record';
import {
  mapExecutionAuditRecordToPersistence,
  type ExecutionAuditPersistenceData
} from './execution-audit-persistence';

export type ExecutionAuditStore = {
  decisionExists(decisionId: number): Promise<boolean>;
  findByDecisionId(decisionId: number): Promise<ExecutionAuditPersistenceData | null>;
  create(data: ExecutionAuditPersistenceData): Promise<ExecutionAuditPersistenceData>;
};

export type SaveExecutionAuditInput = {
  decisionId: number;
  audit: ExecutionAuditInput;
};

export type SaveExecutionAuditResult = {
  record: ExecutionAuditRecord;
  persisted: ExecutionAuditPersistenceData;
};

export class DecisionNotFoundError extends Error {
  constructor(decisionId: number) {
    super(`Decision ${decisionId} was not found.`);
    this.name = 'DecisionNotFoundError';
  }
}

export class ExecutionAuditAlreadyExistsError extends Error {
  constructor(decisionId: number) {
    super(`Execution audit for decision ${decisionId} already exists.`);
    this.name = 'ExecutionAuditAlreadyExistsError';
  }
}

export async function saveExecutionAuditRecord(
  store: ExecutionAuditStore,
  input: SaveExecutionAuditInput
): Promise<SaveExecutionAuditResult> {
  const record = buildExecutionAuditRecord(input.audit);
  const data = mapExecutionAuditRecordToPersistence(input.decisionId, record);

  if (!(await store.decisionExists(input.decisionId))) {
    throw new DecisionNotFoundError(input.decisionId);
  }

  if (await store.findByDecisionId(input.decisionId)) {
    throw new ExecutionAuditAlreadyExistsError(input.decisionId);
  }

  return {
    record,
    persisted: await store.create(data)
  };
}
