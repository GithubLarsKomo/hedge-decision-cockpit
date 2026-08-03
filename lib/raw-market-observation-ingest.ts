import { marketSignalWindowStart } from './market-signal-derivation';
import {
  normalizeMarketSnapshot,
  normalizeMarketSnapshotBatch,
  type MarketSnapshotInput,
  type NormalizedMarketSnapshot
} from './market-snapshot';
import { persistMarketSnapshots, type PersistMarketSnapshotsResult } from './market-snapshot-store';

export type RawMarketObservationInput = Omit<MarketSnapshotInput, 'ndxReferenceHigh'>;
export type RawMarketObservationIngestBody = RawMarketObservationInput | { observations: RawMarketObservationInput[] };

type StoredNdxObservation = {
  observedAt: Date;
  ndxClose: number;
};

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

export type RawMarketObservationStore = {
  marketSnapshot: {
    findMany(args: {
      where: {
        source: string;
        observedAt: { gte: Date; lte: Date };
      };
      orderBy: { observedAt: 'asc' };
      select: { observedAt: true; ndxClose: true };
    }): Promise<StoredNdxObservation[]>;
    createMany(args: {
      data: MarketSnapshotCreateData[];
      skipDuplicates: boolean;
    }): Promise<{ count: number }>;
  };
};

function parseRawObservation(value: unknown): RawMarketObservationInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Each raw market observation must be an object.');
  }
  const input = value as Record<string, unknown>;
  if ('ndxReferenceHigh' in input) {
    throw new Error('Raw market observation must not supply ndxReferenceHigh; it is derived from stored history.');
  }
  if (typeof input.observedAt !== 'string') throw new Error('observedAt must be an ISO timestamp string.');
  if (typeof input.source !== 'string') throw new Error('source must be a string.');
  if (typeof input.ndxClose !== 'number') throw new Error('ndxClose must be a number.');

  const provisional = normalizeMarketSnapshot({
    observedAt: input.observedAt,
    source: input.source,
    ndxClose: input.ndxClose,
    ndxReferenceHigh: input.ndxClose,
    vixClose: input.vixClose as number | null | undefined,
    vxnClose: input.vxnClose as number | null | undefined,
    riskFreeRate: input.riskFreeRate as number | null | undefined,
    dividendYield: input.dividendYield as number | null | undefined
  });

  return {
    observedAt: provisional.observedAt,
    source: provisional.source,
    ndxClose: provisional.ndxClose,
    vixClose: provisional.vixClose,
    vxnClose: provisional.vxnClose,
    riskFreeRate: provisional.riskFreeRate,
    dividendYield: provisional.dividendYield
  };
}

export function parseRawMarketObservationIngestBody(body: unknown): RawMarketObservationInput[] {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a raw market observation or an observations object.');
  }
  const candidate = body as Record<string, unknown>;
  const raw = Array.isArray(candidate.observations) ? candidate.observations : [body];
  if (raw.length === 0) throw new Error('At least one raw market observation is required.');

  const observations = raw.map(parseRawObservation);
  const identities = new Set<string>();
  for (const observation of observations) {
    const identity = `${observation.source}\u0000${observation.observedAt}`;
    if (identities.has(identity)) {
      throw new Error(`Duplicate raw source and timestamp: ${observation.source} ${observation.observedAt}.`);
    }
    identities.add(identity);
  }
  return observations;
}

export async function enrichRawMarketObservations(
  store: RawMarketObservationStore,
  inputs: RawMarketObservationInput[]
): Promise<NormalizedMarketSnapshot[]> {
  if (inputs.length === 0) return [];
  const normalizedInputs = inputs.map(parseRawObservation);
  const bySource = new Map<string, RawMarketObservationInput[]>();
  for (const input of normalizedInputs) {
    const group = bySource.get(input.source) ?? [];
    group.push(input);
    bySource.set(input.source, group);
  }

  const enriched: MarketSnapshotInput[] = [];
  for (const [source, sourceInputs] of bySource) {
    const ordered = [...sourceInputs].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    const earliest = new Date(ordered[0].observedAt);
    const latest = new Date(ordered[ordered.length - 1].observedAt);
    const stored = await store.marketSnapshot.findMany({
      where: {
        source,
        observedAt: {
          gte: marketSignalWindowStart(earliest),
          lte: latest
        }
      },
      orderBy: { observedAt: 'asc' },
      select: { observedAt: true, ndxClose: true }
    });

    const known: StoredNdxObservation[] = stored.map(row => ({
      observedAt: new Date(row.observedAt),
      ndxClose: row.ndxClose
    }));

    for (const input of ordered) {
      const observedAt = new Date(input.observedAt);
      const start = marketSignalWindowStart(observedAt).getTime();
      const end = observedAt.getTime();
      const trailing = known.filter(row => {
        const time = row.observedAt.getTime();
        return time >= start && time <= end;
      });
      const ndxReferenceHigh = Math.max(input.ndxClose, ...trailing.map(row => row.ndxClose));

      enriched.push({ ...input, ndxReferenceHigh });
      known.push({ observedAt, ndxClose: input.ndxClose });
    }
  }

  return normalizeMarketSnapshotBatch(enriched);
}

export async function ingestRawMarketObservations(
  store: RawMarketObservationStore,
  body: unknown
): Promise<PersistMarketSnapshotsResult> {
  const raw = parseRawMarketObservationIngestBody(body);
  const snapshots = await enrichRawMarketObservations(store, raw);
  return persistMarketSnapshots(store, snapshots);
}
