import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { prisma } from './prisma';
import {
  listEtfMappingReviewHistory,
  persistEtfMappingReviewRecord
} from './etf-mapping-review-history';

const fpA = `sha256:${'a'.repeat(64)}`;
const fpB = `sha256:${'b'.repeat(64)}`;
const fpC = `sha256:${'c'.repeat(64)}`;

function record(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 'etf-mapping-review-record/1.0',
    current_mapping: { mapping_version: '2026-08', mapping_fingerprint: fpA },
    candidate_mapping: { mapping_version: '2026-09', mapping_fingerprint: fpB },
    outcome: 'keep_current',
    reviewer: 'reviewer-1',
    reviewed_at: '2026-08-02T12:00:00.000Z',
    rationale: 'Current mapping remains appropriate.',
    ...overrides
  };
}

describe('ETF mapping review history', () => {
  beforeEach(async () => {
    await prisma.etfMappingReviewRecord.deleteMany();
  });

  it('persists a valid review record and is idempotent by record fingerprint', async () => {
    const first = await persistEtfMappingReviewRecord(record());
    const second = await persistEtfMappingReviewRecord(record());

    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.id, first.id);
    assert.equal(second.recordFingerprint, first.recordFingerprint);
    assert.equal(await prisma.etfMappingReviewRecord.count(), 1);
  });

  it('returns history ordered by reviewed_at descending and then id descending', async () => {
    await persistEtfMappingReviewRecord(record({ reviewed_at: '2026-08-01T12:00:00.000Z', rationale: 'older' }));
    await persistEtfMappingReviewRecord(record({ reviewed_at: '2026-08-03T12:00:00.000Z', rationale: 'newer' }));

    const history = await listEtfMappingReviewHistory();
    assert.deepEqual(history.map((entry) => entry.rationale), ['newer', 'older']);
  });

  it('filters history by current mapping fingerprint', async () => {
    await persistEtfMappingReviewRecord(record());
    await persistEtfMappingReviewRecord(record({
      current_mapping: { mapping_version: '2026-07', mapping_fingerprint: fpC },
      candidate_mapping: undefined,
      outcome: 'defer',
      rationale: 'Need more evidence.'
    }));

    const history = await listEtfMappingReviewHistory(fpA);
    assert.equal(history.length, 1);
    assert.equal(history[0]?.currentMappingFingerprint, fpA);
  });

  it('rejects invalid records before persistence', async () => {
    await assert.rejects(
      () => persistEtfMappingReviewRecord(record({ reviewer: '' }))
    );
    assert.equal(await prisma.etfMappingReviewRecord.count(), 0);
  });
});
