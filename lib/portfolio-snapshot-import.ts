import type { PortfolioSnapshot } from './portfolio-snapshot';
import { validatePortfolioSnapshot } from './portfolio-snapshot';

export type ImportedPortfolioSnapshotRecord = {
  snapshotId: string;
  revision: number;
  asOf: Date;
  generatedAt: Date;
  schemaVersion: string;
  strategyName: string;
  strategyVersion: string;
  inputFingerprint: string;
  payloadJson: PortfolioSnapshot;
};

export type PortfolioSnapshotImportStore = {
  findBySnapshotRevision(snapshotId: string, revision: number): Promise<ImportedPortfolioSnapshotRecord | null>;
  findByFingerprint(inputFingerprint: string): Promise<ImportedPortfolioSnapshotRecord | null>;
  create(data: ImportedPortfolioSnapshotRecord): Promise<ImportedPortfolioSnapshotRecord>;
};

export type PortfolioSnapshotImportResult =
  | { status: 'created'; record: ImportedPortfolioSnapshotRecord }
  | { status: 'idempotent'; record: ImportedPortfolioSnapshotRecord };

export class PortfolioSnapshotRevisionConflictError extends Error {
  constructor(snapshotId: string, revision: number) {
    super(`Snapshot ${snapshotId} revision ${revision} already exists with different content.`);
    this.name = 'PortfolioSnapshotRevisionConflictError';
  }
}

export class PortfolioSnapshotFingerprintConflictError extends Error {
  constructor(fingerprint: string) {
    super(`Fingerprint ${fingerprint} is already assigned to a different snapshot revision.`);
    this.name = 'PortfolioSnapshotFingerprintConflictError';
  }
}

function toRecord(snapshot: PortfolioSnapshot): ImportedPortfolioSnapshotRecord {
  return {
    snapshotId: snapshot.snapshot_id,
    revision: snapshot.revision,
    asOf: new Date(`${snapshot.as_of}T00:00:00.000Z`),
    generatedAt: new Date(snapshot.generated_at),
    schemaVersion: snapshot.schema_version,
    strategyName: snapshot.strategy.name,
    strategyVersion: snapshot.strategy.version,
    inputFingerprint: snapshot.input_fingerprint,
    payloadJson: snapshot
  };
}

export async function importPortfolioSnapshot(
  store: PortfolioSnapshotImportStore,
  input: unknown
): Promise<PortfolioSnapshotImportResult> {
  const snapshot = validatePortfolioSnapshot(input);
  const candidate = toRecord(snapshot);

  const existingRevision = await store.findBySnapshotRevision(candidate.snapshotId, candidate.revision);
  if (existingRevision) {
    if (existingRevision.inputFingerprint === candidate.inputFingerprint) {
      return { status: 'idempotent', record: existingRevision };
    }
    throw new PortfolioSnapshotRevisionConflictError(candidate.snapshotId, candidate.revision);
  }

  const existingFingerprint = await store.findByFingerprint(candidate.inputFingerprint);
  if (existingFingerprint) {
    throw new PortfolioSnapshotFingerprintConflictError(candidate.inputFingerprint);
  }

  return { status: 'created', record: await store.create(candidate) };
}
