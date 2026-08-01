import type { ImportedPortfolioSnapshotRecord, PortfolioSnapshotImportStore } from './portfolio-snapshot-import';

type ImportedPortfolioSnapshotDelegate = {
  findUnique(args: {
    where:
      | { snapshotId_revision: { snapshotId: string; revision: number } }
      | { inputFingerprint: string };
  }): Promise<ImportedPortfolioSnapshotRecord | null>;
  create(args: { data: ImportedPortfolioSnapshotRecord }): Promise<ImportedPortfolioSnapshotRecord>;
};

export type PortfolioSnapshotImportPrismaClient = {
  importedPortfolioSnapshot: ImportedPortfolioSnapshotDelegate;
};

export function createPrismaPortfolioSnapshotImportStore(
  client: PortfolioSnapshotImportPrismaClient
): PortfolioSnapshotImportStore {
  return {
    findBySnapshotRevision(snapshotId, revision) {
      return client.importedPortfolioSnapshot.findUnique({
        where: { snapshotId_revision: { snapshotId, revision } }
      });
    },
    findByFingerprint(inputFingerprint) {
      return client.importedPortfolioSnapshot.findUnique({ where: { inputFingerprint } });
    },
    create(data) {
      return client.importedPortfolioSnapshot.create({ data });
    }
  };
}
