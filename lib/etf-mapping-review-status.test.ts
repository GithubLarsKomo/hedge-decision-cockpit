import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { evaluateEtfMappingReviewStatus } from './etf-mapping-review-status';

const mapping = JSON.parse(
  readFileSync(join(process.cwd(), 'fixtures', 'etf-mapping', '2026-08.json'), 'utf8')
);
const policy = { review_interval_days: 90, overdue_grace_days: 14 };

describe('ETF mapping review status', () => {
  it('is current before the scheduled review date', () => {
    const result = evaluateEtfMappingReviewStatus(mapping, '2026-11-28', policy);
    assert.equal(result.status, 'current');
    assert.equal(result.next_review_date, '2026-11-29');
    assert.equal(result.days_until_due, 1);
  });

  it('becomes due exactly on the scheduled review date', () => {
    const result = evaluateEtfMappingReviewStatus(mapping, '2026-11-29', policy);
    assert.equal(result.status, 'due');
    assert.equal(result.days_until_due, 0);
  });

  it('remains due through the configured grace window', () => {
    const result = evaluateEtfMappingReviewStatus(mapping, '2026-12-13', policy);
    assert.equal(result.status, 'due');
    assert.equal(result.days_until_due, -14);
  });

  it('becomes overdue after the grace window', () => {
    const result = evaluateEtfMappingReviewStatus(mapping, '2026-12-14', policy);
    assert.equal(result.status, 'overdue');
    assert.equal(result.days_until_due, -15);
  });

  it('is deterministic and carries mapping identity', () => {
    const first = evaluateEtfMappingReviewStatus(mapping, '2026-11-29', policy);
    const second = evaluateEtfMappingReviewStatus(mapping, '2026-11-29', policy);
    assert.deepEqual(first, second);
    assert.equal(first.mapping_version, mapping.mapping_version);
    assert.match(first.mapping_fingerprint, /^sha256:[a-f0-9]{64}$/);
  });

  it('rejects invalid policy values and dates', () => {
    assert.throws(() => evaluateEtfMappingReviewStatus(mapping, '2026-11-29', { review_interval_days: 0, overdue_grace_days: 14 }));
    assert.throws(() => evaluateEtfMappingReviewStatus(mapping, '2026-02-30', policy), /valid calendar date/);
    assert.throws(() => evaluateEtfMappingReviewStatus(mapping, '2026-07-31', policy), /cannot precede/);
  });
});
