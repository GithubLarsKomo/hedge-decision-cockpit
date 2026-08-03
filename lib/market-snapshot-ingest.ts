import { normalizeMarketSnapshotBatch, type MarketSnapshotInput, type NormalizedMarketSnapshot } from './market-snapshot';

export type MarketSnapshotIngestBody = MarketSnapshotInput | { observations: MarketSnapshotInput[] };

export function normalizeMarketSnapshotIngestBody(body: unknown): NormalizedMarketSnapshot[] {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a market observation or an observations object.');
  }

  const candidate = body as Record<string, unknown>;
  const raw = Array.isArray(candidate.observations) ? candidate.observations : [body];
  if (raw.length === 0) throw new Error('At least one market observation is required.');

  return normalizeMarketSnapshotBatch(raw as MarketSnapshotInput[]);
}
