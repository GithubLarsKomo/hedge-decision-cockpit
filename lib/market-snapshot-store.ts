import type { NormalizedMarketSnapshot } from './market-snapshot';

type MarketSnapshotCreateData = {
  observedAt: Date;
  source: string;
  contentHash: string;
  ndxClose: number;
  ndxReferenceHigh: number;
  ndxDrawdownPercent: number;
  vixClose: number | null;
  vxnClose: number | null;
  riskFreeRate: number | null;
  dividendYield: number | null;
};

type ExistingMarketSnapshot = {
  contentHash: string;
  source: string;
  observedAt: Date;
};

// Prisma's generated delegate signatures differ slightly by connector (for example,
// SQLite intentionally omits skipDuplicates). Keep this narrow boundary structural
// and validate/cast projections immediately inside the persistence functions.
export type MarketSnapshotDelegate = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findMany(args: any): Promise<any[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createMany(args: any): Promise<{ count: number }>;
};

export type MarketSnapshotStore = {
  marketSnapshot: MarketSnapshotDelegate;
};

export type PersistMarketSnapshotsResult = {
  requested: number;
  inserted: number;
  skipped: number;
};

const PERSISTENCE_CHUNK_SIZE = 50;

export function toMarketSnapshotCreateData(snapshot: NormalizedMarketSnapshot): MarketSnapshotCreateData {
  const observedAt = new Date(snapshot.observedAt);
  if (Number.isNaN(observedAt.getTime())) {
    throw new Error('Normalized snapshot contains an invalid observedAt value.');
  }

  return {
    observedAt,
    source: snapshot.source,
    contentHash: snapshot.contentHash,
    ndxClose: snapshot.ndxClose,
    ndxReferenceHigh: snapshot.ndxReferenceHigh,
    ndxDrawdownPercent: snapshot.ndxDrawdownPercent,
    vixClose: snapshot.vixClose,
    vxnClose: snapshot.vxnClose,
    riskFreeRate: snapshot.riskFreeRate,
    dividendYield: snapshot.dividendYield
  };
}

function sourceTimeKey(source: string, observedAt: string | Date): string {
  const iso = observedAt instanceof Date ? observedAt.toISOString() : observedAt;
  return `${source}\u0000${iso}`;
}

function asExistingMarketSnapshots(rows: unknown[]): ExistingMarketSnapshot[] {
  return rows.map(row => {
    if (!row || typeof row !== 'object') throw new Error('Database returned an invalid MarketSnapshot projection.');
    const value = row as Record<string, unknown>;
    if (typeof value.contentHash !== 'string' || typeof value.source !== 'string') {
      throw new Error('Database returned an incomplete MarketSnapshot projection.');
    }
    const observedAt = value.observedAt instanceof Date ? value.observedAt : new Date(String(value.observedAt));
    if (Number.isNaN(observedAt.getTime())) throw new Error('Database returned an invalid MarketSnapshot observedAt value.');
    return { contentHash: value.contentHash, source: value.source, observedAt };
  });
}

export async function persistMarketSnapshots(
  store: MarketSnapshotStore,
  snapshots: NormalizedMarketSnapshot[]
): Promise<PersistMarketSnapshotsResult> {
  if (snapshots.length === 0) return { requested: 0, inserted: 0, skipped: 0 };

  const hashes = new Set<string>();
  const sourceTimes = new Set<string>();
  for (const snapshot of snapshots) {
    if (hashes.has(snapshot.contentHash)) {
      throw new Error(`Duplicate content hash in persistence batch: ${snapshot.contentHash}.`);
    }
    const sourceTime = sourceTimeKey(snapshot.source, snapshot.observedAt);
    if (sourceTimes.has(sourceTime)) {
      throw new Error(`Duplicate source and timestamp in persistence batch: ${snapshot.source} ${snapshot.observedAt}.`);
    }
    hashes.add(snapshot.contentHash);
    sourceTimes.add(sourceTime);
  }

  let inserted = 0;
  let skipped = 0;

  for (let offset = 0; offset < snapshots.length; offset += PERSISTENCE_CHUNK_SIZE) {
    const chunk = snapshots.slice(offset, offset + PERSISTENCE_CHUNK_SIZE);
    const createData = chunk.map(toMarketSnapshotCreateData);

    const [existingByHashRaw, existingBySourceTimeRaw] = await Promise.all([
      store.marketSnapshot.findMany({
        where: { contentHash: { in: chunk.map(snapshot => snapshot.contentHash) } },
        select: { contentHash: true, source: true, observedAt: true }
      }),
      store.marketSnapshot.findMany({
        where: {
          OR: createData.map(snapshot => ({ source: snapshot.source, observedAt: snapshot.observedAt }))
        },
        select: { contentHash: true, source: true, observedAt: true }
      })
    ]);

    const existingByHash = asExistingMarketSnapshots(existingByHashRaw);
    const existingBySourceTime = asExistingMarketSnapshots(existingBySourceTimeRaw);
    const existingHashes = new Set(existingByHash.map(row => row.contentHash));
    const existingSourceTimes = new Set(
      existingBySourceTime.map(row => sourceTimeKey(row.source, row.observedAt))
    );

    const newRows = createData.filter(row => (
      !existingHashes.has(row.contentHash)
      && !existingSourceTimes.has(sourceTimeKey(row.source, row.observedAt))
    ));

    skipped += createData.length - newRows.length;
    if (newRows.length === 0) continue;

    const result = await store.marketSnapshot.createMany({ data: newRows });
    inserted += result.count;
    skipped += newRows.length - result.count;
  }

  return { requested: snapshots.length, inserted, skipped };
}
