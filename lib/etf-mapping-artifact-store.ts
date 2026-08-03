import { prisma } from './prisma';
import {
  computeEtfMappingFingerprint,
  validateEtfNearestNeighbourMapping,
  type EtfNearestNeighbourMapping
} from './etf-nearest-neighbour-mapping';

export type EtfMappingArtifactEntry = {
  id: number;
  createdAt: Date;
  mappingVersion: string;
  effectiveDate: Date;
  mappingFingerprint: string;
  schemaVersion: string;
  mapping: EtfNearestNeighbourMapping;
};

function toEntry(row: {
  id: number;
  createdAt: Date;
  mappingVersion: string;
  effectiveDate: Date;
  mappingFingerprint: string;
  schemaVersion: string;
  payloadJson: unknown;
}): EtfMappingArtifactEntry {
  return {
    id: row.id,
    createdAt: row.createdAt,
    mappingVersion: row.mappingVersion,
    effectiveDate: row.effectiveDate,
    mappingFingerprint: row.mappingFingerprint,
    schemaVersion: row.schemaVersion,
    mapping: validateEtfNearestNeighbourMapping(row.payloadJson)
  };
}

export async function persistEtfMappingArtifact(value: unknown): Promise<{ entry: EtfMappingArtifactEntry; created: boolean }> {
  const mapping = validateEtfNearestNeighbourMapping(value);
  const fingerprint = computeEtfMappingFingerprint(mapping);

  const existing = await prisma.etfMappingArtifact.findUnique({ where: { mappingFingerprint: fingerprint } });
  if (existing) {
    return { entry: toEntry(existing), created: false };
  }

  const created = await prisma.etfMappingArtifact.create({
    data: {
      mappingVersion: mapping.mapping_version,
      effectiveDate: new Date(`${mapping.effective_date}T00:00:00.000Z`),
      mappingFingerprint: fingerprint,
      schemaVersion: mapping.schema_version,
      payloadJson: mapping
    }
  });

  return { entry: toEntry(created), created: true };
}

export async function getEtfMappingArtifactByFingerprint(fingerprint: string): Promise<EtfMappingArtifactEntry | null> {
  const row = await prisma.etfMappingArtifact.findUnique({ where: { mappingFingerprint: fingerprint } });
  return row ? toEntry(row) : null;
}

export async function listEtfMappingArtifacts(): Promise<EtfMappingArtifactEntry[]> {
  const rows = await prisma.etfMappingArtifact.findMany({
    orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
  });
  return rows.map(toEntry);
}

export async function getLatestEtfMappingArtifact(): Promise<EtfMappingArtifactEntry | null> {
  const row = await prisma.etfMappingArtifact.findFirst({
    orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
  });
  return row ? toEntry(row) : null;
}
