import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateApplicationReadiness } from './application-readiness';

const passingCheck = { name: 'database', ok: true, detail: 'Database connection available.' };
const failingCheck = { name: 'database', ok: false, detail: 'Database connection unavailable.' };

test('reports ready when all checks pass', () => {
  const result = evaluateApplicationReadiness({
    checkedAt: '2026-07-29T22:00:00.000Z',
    version: '1.19.0',
    checks: [passingCheck]
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.checkedAt, '2026-07-29T22:00:00.000Z');
});

test('reports degraded for a failed check', () => {
  const result = evaluateApplicationReadiness({
    checkedAt: '2026-07-29T22:00:00Z',
    version: '1.19.0',
    checks: [failingCheck]
  });
  assert.equal(result.status, 'degraded');
  assert.deepEqual(result.checks.filter(check => !check.ok).map(check => check.name), ['database']);
});

test('rejects invalid or empty metadata', () => {
  assert.throws(() => evaluateApplicationReadiness({
    checkedAt: 'invalid',
    version: '1.19.0',
    checks: [passingCheck]
  }), /checkedAt/);

  assert.throws(() => evaluateApplicationReadiness({
    checkedAt: '2026-07-29T22:00:00Z',
    version: '1.19.0',
    checks: []
  }), /checks/);
});
