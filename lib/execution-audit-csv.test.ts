import assert from 'node:assert/strict';
import test from 'node:test';
import type { DecisionRow } from '@/components/Dashboard';
import { buildExecutionAuditCsv } from './execution-audit-csv';

function decision(): DecisionRow {
  return {
    id: 42,
    createdAt: '2026-07-31T08:00:00.000Z',
    ndxNow: 100,
    ndxHigh2y: 110,
    ndxDrawdownPct: -9.1,
    vixNow: 20,
    vixPercentile: 50,
    hedgeCoveragePercent: null,
    action: 'HOLD',
    severity: 'INFO',
    recommendation: 'Hold',
    triggeredRules: ['NO_ACTION'],
    hedgeMarketValueEur: null,
    hedgeUnrealizedGainEur: null,
    notes: null,
    executionAudit: {
      approvalDecision: 'APPROVED',
      approvalRecordedAt: '2026-07-31T08:05:00.000Z',
      executionStatus: 'PARTIALLY_EXECUTED',
      executionRecordedAt: '2026-07-31T08:10:00.000Z',
      recommendedStrategy: 'LONG_PUT',
      recommendedContracts: 8,
      executedStrategy: 'LONG_PUT',
      executedContracts: 5,
      strategyChanged: false,
      contractQuantityChanged: true,
      notFullyExecuted: true,
      deviationReason: 'Only five, "inside limit"'
    }
  };
}

test('serializes audited decisions with BOM and escaped cells', () => {
  const csv = buildExecutionAuditCsv([decision()]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"42"/);
  assert.match(csv, /"true"/);
  assert.match(csv, /"Only five, ""inside limit"""/);
});

test('omits decisions without an audit record', () => {
  const withoutAudit = decision();
  withoutAudit.executionAudit = null;
  const csv = buildExecutionAuditCsv([withoutAudit]);
  assert.equal(csv.split('\n').length, 1);
});
