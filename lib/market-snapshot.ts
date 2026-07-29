import { createHash } from 'node:crypto';

export type MarketSnapshotInput = {
  observedAt: string;
  source: string;
  ndxClose: number;
  ndxReferenceHigh: number;
  vixClose?: number | null;
  vxnClose?: number | null;
  riskFreeRate?: number | null;
  dividendYield?: number | null;
};

export type NormalizedMarketSnapshot = {
  observedAt: string;
  source: string;
  ndxClose: number;
  ndxReferenceHigh: number;
  ndxDrawdownPercent: number;
  vixClose: number | null;
  vxnClose: number | null;
  riskFreeRate: number | null;
  dividendYield: number | null;
  contentHash: string;
};

function optionalFinite(value: number | null | undefined, name: string): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite when supplied.`);
  return value;
}

export function normalizeMarketSnapshot(input: MarketSnapshotInput): NormalizedMarketSnapshot {
  const observedAt = new Date(input.observedAt);
  if (Number.isNaN(observedAt.getTime())) throw new Error('observedAt must be a valid ISO timestamp.');
  const source = input.source.trim();
  if (!source || source.length > 120) throw new Error('source must contain 1 to 120 characters.');
  if (!Number.isFinite(input.ndxClose) || input.ndxClose <= 0) throw new Error('ndxClose must be positive and finite.');
  if (!Number.isFinite(input.ndxReferenceHigh) || input.ndxReferenceHigh <= 0) {
    throw new Error('ndxReferenceHigh must be positive and finite.');
  }
  if (input.ndxClose > input.ndxReferenceHigh) throw new Error('ndxClose cannot exceed ndxReferenceHigh.');

  const canonical = {
    observedAt: observedAt.toISOString(),
    source,
    ndxClose: input.ndxClose,
    ndxReferenceHigh: input.ndxReferenceHigh,
    ndxDrawdownPercent: Number(((input.ndxClose / input.ndxReferenceHigh - 1) * 100).toFixed(6)),
    vixClose: optionalFinite(input.vixClose, 'vixClose'),
    vxnClose: optionalFinite(input.vxnClose, 'vxnClose'),
    riskFreeRate: optionalFinite(input.riskFreeRate, 'riskFreeRate'),
    dividendYield: optionalFinite(input.dividendYield, 'dividendYield')
  };

  return {
    ...canonical,
    contentHash: createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
  };
}

export function normalizeMarketSnapshotBatch(inputs: MarketSnapshotInput[]): NormalizedMarketSnapshot[] {
  const snapshots = inputs.map(normalizeMarketSnapshot).sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  const keys = new Set<string>();
  const hashes = new Set<string>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.source}\u0000${snapshot.observedAt}`;
    if (keys.has(key)) throw new Error(`Duplicate source and timestamp: ${snapshot.source} ${snapshot.observedAt}.`);
    if (hashes.has(snapshot.contentHash)) throw new Error(`Duplicate market snapshot content: ${snapshot.contentHash}.`);
    keys.add(key);
    hashes.add(snapshot.contentHash);
  }
  return snapshots;
}