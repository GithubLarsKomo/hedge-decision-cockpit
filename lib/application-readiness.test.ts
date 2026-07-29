import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateApplicationReadiness } from './application-readiness';

test('reports ready when all checks pass', () => {
  const result = evaluateApplicationReadiness({
    checkedAt: '2026-07-29T22:00:00.000Z',
    version: '1.19.0',
    databaseReachable: true,
    ingestTokenConfigured: true,
    dashboardAuthConfigured: true
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.checks.length, 3);
});

test('reports degraded for failed checks', () => {
  const result = evaluateApplicationReadiness({
    checkedAt: '2026-07-29T22:00:00Z',
    version: '1.19.0',
    databaseReachable: false,
    ingestTokenConfigured: true,
    dashboardAuthConfigured: false
  });
  assert.equal(result.status, 'degraded');
  assert.deepEqual(result.checks.filter(check => !check.ok).map(check => check.name), ['database', 'dashboard-auth']);
});

test('rejects invalid metadata', () => {
  assert.throws(() => evaluateApplicationReadiness({
    checkedAt: 'invalid',
    version: '1.19.0',
    databaseReachable: true,
    ingestTokenConfigured: true,
    dashboardAuthConfigured: true
  }), /checkedAt/);
});
