import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import {
  computeEtfMappingReviewRecordFingerprint,
  validateEtfMappingReviewRecord,
  type EtfMappingReviewRecord
} from './etf-mapping-review-record';

export type PersistedEtfMappingReviewRecord = {
  id: number;
  recordFingerprint: string;
  currentMappingFingerprint: string;
  reviewedAt: Date;
  created: boolean;
};

export type EtfMappingReviewHistoryEntry = {
  id: number;
  recordFingerprint: string;
  currentMappingVersion: string;
  currentMappingFingerprint: string;
  candidateMappingVersion: string | null;
  candidateMappingFingerprint: string | null;
  outcome: string;
  reviewer: string;
  reviewedAt: Date;
  rationale: string;
};

function toJson(value: EtfMappingReviewRecord): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

export async function persistEtfMappingReviewRecord(value: unknown): Promise<PersistedEtfMappingReviewRecord> {
  const record = validateEtfMappingReviewRecord(value);
  const fingerprint = computeEtfMappingReviewRecordFingerprint(record);
  const existing = await prisma.etfMappingReviewRecord.findUnique({
    where: { recordFingerprint: fingerprint }
  });

  if (existing) {
    return {
      id: existing.id,
      recordFingerprint: existing.recordFingerprint,
      currentMappingFingerprint: existing.currentMappingFingerprint,
      reviewedAt: existing.reviewedAt,
      created: false
    };
  }

  try {
    const created = await prisma.etfMappingReviewRecord.create({
      data: {
        recordFingerprint: fingerprint,
        schemaVersion: record.schema_version,
        currentMappingVersion: record.current_mapping.mapping_version,
        currentMappingFingerprint: record.current_mapping.mapping_fingerprint,
        candidateMappingVersion: record.candidate_mapping?.mapping_version ?? null,
        candidateMappingFingerprint: record.candidate_mapping?.mapping_fingerprint ?? null,
        outcome: record.outcome,
        reviewer: record.reviewer,
        reviewedAt: new Date(record.reviewed_at),
        rationale: record.rationale,
        payloadJson: toJson(record)
      }
    });

    return {
      id: created.id,
      recordFingerprint: created.recordFingerprint,
      currentMappingFingerprint: created.currentMappingFingerprint,
      reviewedAt: created.reviewedAt,
      created: true
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await prisma.etfMappingReviewRecord.findUnique({
        where: { recordFingerprint: fingerprint }
      });
      if (raced) {
        return {
          id: raced.id,
          recordFingerprint: raced.recordFingerprint,
          currentMappingFingerprint: raced.currentMappingFingerprint,
          reviewedAt: raced.reviewedAt,
          created: false
        };
      }
    }
    throw error;
  }
}

export async function listEtfMappingReviewHistory(
  currentMappingFingerprint?: string
): Promise<EtfMappingReviewHistoryEntry[]> {
  const rows = await prisma.etfMappingReviewRecord.findMany({
    where: currentMappingFingerprint ? { currentMappingFingerprint } : undefined,
    orderBy: [{ reviewedAt: 'desc' }, { id: 'desc' }]
  });

  return rows.map((row) => ({
    id: row.id,
    recordFingerprint: row.recordFingerprint,
    currentMappingVersion: row.currentMappingVersion,
    currentMappingFingerprint: row.currentMappingFingerprint,
    candidateMappingVersion: row.candidateMappingVersion,
    candidateMappingFingerprint: row.candidateMappingFingerprint,
    outcome: row.outcome,
    reviewer: row.reviewer,
    reviewedAt: row.reviewedAt,
    rationale: row.rationale
  }));
}
