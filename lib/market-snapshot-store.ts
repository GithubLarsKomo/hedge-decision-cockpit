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

export type MarketSnapshotDelegate = {
  createMany(args: {
    data: MarketSnapshotCreateData[];
    skipDuplicates: boolean;
  }): Promise<{ count: number }>;
};

export type MarketSnapshotStore = {
  marketSnapshot: MarketSnapshotDelegate;
};

export type PersistMarketSnapshotsResult = {
  requested: number;
  inserted: number;
  skipped: number;
};

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
    const sourceTime = `${snapshot.source}\u0000${snapshot.observedAt}`;
    if (sourceTimes.has(sourceTime)) {
      throw new Error(`Duplicate source and timestamp in persistence batch: ${snapshot.source} ${snapshot.observedAt}.`);
    }
    hashes.add(snapshot.contentHash);
    sourceTimes.add(sourceTime);
  }

  const result = await store.marketSnapshot.createMany({
    data: snapshots.map(toMarketSnapshotCreateData),
    skipDuplicates: true
  });

  return {
    requested: snapshots.length,
    inserted: result.count,
    skipped: snapshots.length - result.count
  };
}