import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from './prisma';
import {
  getEtfMappingArtifactByFingerprint,
  getLatestEtfMappingArtifact,
  listEtfMappingArtifacts,
  persistEtfMappingArtifact
} from './etf-mapping-artifact-store';

const mapping = {
  schema_version: 'etf-nearest-neighbour-mapping/1.0' as const,
  mapping_version: '2026-08',
  effective_date: '2026-08-01',
  exposures: [{
    exposure_id: 'global-equity',
    desired_reference: 'MSCI ACWI',
    selected_instrument_id: 'ETF-A',
    candidates: [{
      instrument_id: 'ETF-A',
      exposure_fidelity: 0.99,
      ter: 0.002,
      savings_plan_eligible: true,
      tradable: true,
      active_for_new_purchases: true
    }]
  }]
};

test('ETF mapping artifact persistence is idempotent and queryable', async () => {
  await prisma.etfMappingArtifact.deleteMany();

  const first = await persistEtfMappingArtifact(mapping);
  const second = await persistEtfMappingArtifact(mapping);

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.entry.id, first.entry.id);
  assert.equal(second.entry.mappingFingerprint, first.entry.mappingFingerprint);

  const byFingerprint = await getEtfMappingArtifactByFingerprint(first.entry.mappingFingerprint);
  assert.equal(byFingerprint?.mapping.mapping_version, '2026-08');

  const latest = await getLatestEtfMappingArtifact();
  assert.equal(latest?.mappingFingerprint, first.entry.mappingFingerprint);

  const list = await listEtfMappingArtifacts();
  assert.equal(list.length, 1);
});

test('ETF mapping artifact store rejects invalid mappings before persistence', async () => {
  await assert.rejects(
    () => persistEtfMappingArtifact({ ...mapping, exposures: [] }),
    /Too small|at least|Array must contain/i
  );
});
