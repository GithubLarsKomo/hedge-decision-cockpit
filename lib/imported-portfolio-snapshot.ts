import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { validatePortfolioSnapshot, type PortfolioSnapshot } from './portfolio-snapshot';

export class PortfolioSnapshotConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortfolioSnapshotConflictError';
  }
}

export type ImportedPortfolioSnapshotRecord = {
  id: number;
  snapshotId: string;
  revision: number;
  inputFingerprint: string;
  created: boolean;
};

async function findExisting(snapshotId: string, revision: number) {
  return prisma.importedPortfolioSnapshot.findUnique({
    where: { snapshotId_revision: { snapshotId, revision } }
  });
}

function toJson(value: PortfolioSnapshot): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

export async function importPortfolioSnapshot(value: unknown): Promise<ImportedPortfolioSnapshotRecord> {
  const snapshot = validatePortfolioSnapshot(value);
  const existing = await findExisting(snapshot.snapshot_id, snapshot.revision);

  if (existing) {
    if (existing.inputFingerprint !== snapshot.input_fingerprint) {
      throw new PortfolioSnapshotConflictError(
        `Snapshot ${snapshot.snapshot_id} revision ${snapshot.revision} already exists with different content.`
      );
    }
    return {
      id: existing.id,
      snapshotId: existing.snapshotId,
      revision: existing.revision,
      inputFingerprint: existing.inputFingerprint,
      created: false
    };
  }

  try {
    const created = await prisma.importedPortfolioSnapshot.create({
      data: {
        snapshotId: snapshot.snapshot_id,
        revision: snapshot.revision,
        asOf: new Date(`${snapshot.as_of}T00:00:00.000Z`),
        generatedAt: new Date(snapshot.generated_at),
        schemaVersion: snapshot.schema_version,
        strategyName: snapshot.strategy.name,
        strategyVersion: snapshot.strategy.version,
        inputFingerprint: snapshot.input_fingerprint,
        payloadJson: toJson(snapshot)
      }
    });

    return {
      id: created.id,
      snapshotId: created.snapshotId,
      revision: created.revision,
      inputFingerprint: created.inputFingerprint,
      created: true
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await findExisting(snapshot.snapshot_id, snapshot.revision);
      if (raced?.inputFingerprint === snapshot.input_fingerprint) {
        return {
          id: raced.id,
          snapshotId: raced.snapshotId,
          revision: raced.revision,
          inputFingerprint: raced.inputFingerprint,
          created: false
        };
      }
      throw new PortfolioSnapshotConflictError(
        `Snapshot ${snapshot.snapshot_id} revision ${snapshot.revision} conflicts with an existing import.`
      );
    }
    throw error;
  }
}
