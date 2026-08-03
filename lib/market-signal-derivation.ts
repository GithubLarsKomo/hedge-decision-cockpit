import type { DecisionEngineInput } from './decision-engine';

export const MARKET_SIGNAL_LOOKBACK_YEARS = 2;
export const MIN_NDX_HISTORY_OBSERVATIONS = 400;
export const MIN_VIX_HISTORY_OBSERVATIONS = 200;

export type MarketSignalHistoryObservation = {
  observedAt: Date | string;
  ndxClose: number;
  vixClose: number | null;
};

export type DerivedHedgeSignals = {
  observedAt: string;
  ndxNow: number;
  ndxReferenceHigh: number;
  drawdownPercent: number;
  vixNow: number;
  vixPercentile: number;
  ndxObservationCount: number;
  vixObservationCount: number;
  decisionInput: DecisionEngineInput;
};

export type MarketSignalHistoryDelegate = {
  findFirst(args: {
    where: { source: string };
    orderBy: { observedAt: 'desc' };
    select: { observedAt: true };
  }): Promise<{ observedAt: Date } | null>;
  findMany(args: {
    where: {
      source: string;
      observedAt: { gte: Date; lte: Date };
    };
    orderBy: { observedAt: 'asc' };
    select: { observedAt: true; ndxClose: true; vixClose: true };
  }): Promise<Array<{ observedAt: Date; ndxClose: number; vixClose: number | null }>>;
};

export type MarketSignalStore = {
  marketSnapshot: MarketSignalHistoryDelegate;
};

export type DeriveStoredHedgeSignalOptions = {
  source: string;
  asOf?: Date | string;
  hedgeCoveragePercent?: number | null;
};

function parseTimestamp(value: Date | string, name: string): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${name} must be a valid timestamp.`);
  return date;
}

export function marketSignalWindowStart(asOf: Date | string): Date {
  const end = parseTimestamp(asOf, 'asOf');
  const start = new Date(end.getTime());
  start.setUTCFullYear(start.getUTCFullYear() - MARKET_SIGNAL_LOOKBACK_YEARS);
  return start;
}

export function deriveHedgeSignalsFromHistory(
  observations: MarketSignalHistoryObservation[],
  options: { asOf?: Date | string; hedgeCoveragePercent?: number | null } = {}
): DerivedHedgeSignals {
  if (observations.length === 0) throw new Error('Market history is empty.');

  const ordered = observations
    .map(observation => ({
      observedAt: parseTimestamp(observation.observedAt, 'observedAt'),
      ndxClose: observation.ndxClose,
      vixClose: observation.vixClose
    }))
    .sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());

  for (const observation of ordered) {
    if (!Number.isFinite(observation.ndxClose) || observation.ndxClose <= 0) {
      throw new Error(`Invalid NDX close at ${observation.observedAt.toISOString()}.`);
    }
    if (observation.vixClose != null && (!Number.isFinite(observation.vixClose) || observation.vixClose <= 0)) {
      throw new Error(`Invalid VIX close at ${observation.observedAt.toISOString()}.`);
    }
  }

  const requestedAsOf = options.asOf
    ? parseTimestamp(options.asOf, 'asOf')
    : ordered[ordered.length - 1].observedAt;
  const start = marketSignalWindowStart(requestedAsOf);
  const window = ordered.filter(observation =>
    observation.observedAt.getTime() >= start.getTime()
    && observation.observedAt.getTime() <= requestedAsOf.getTime()
  );

  if (window.length < MIN_NDX_HISTORY_OBSERVATIONS) {
    throw new Error(
      `Insufficient NDX market history: ${window.length}; require at least ${MIN_NDX_HISTORY_OBSERVATIONS} observations in the trailing ${MARKET_SIGNAL_LOOKBACK_YEARS}-year window.`
    );
  }

  const current = window.at(-1);
  if (!current) throw new Error('No market observation exists on or before asOf within the lookback window.');
  if (current.vixClose == null) {
    throw new Error(`Current market observation at ${current.observedAt.toISOString()} has no VIX close.`);
  }

  const vixCloses = window
    .map(observation => observation.vixClose)
    .filter((value): value is number => value != null);
  if (vixCloses.length < MIN_VIX_HISTORY_OBSERVATIONS) {
    throw new Error(
      `Insufficient VIX market history: ${vixCloses.length}; require at least ${MIN_VIX_HISTORY_OBSERVATIONS} observations in the trailing ${MARKET_SIGNAL_LOOKBACK_YEARS}-year window.`
    );
  }

  const ndxReferenceHigh = Math.max(...window.map(observation => observation.ndxClose));
  const drawdownPercent = (current.ndxClose / ndxReferenceHigh - 1) * 100;
  const vixRankCount = vixCloses.filter(value => value <= current.vixClose!).length;
  const vixPercentile = vixRankCount / vixCloses.length * 100;
  const hedgeCoveragePercent = options.hedgeCoveragePercent ?? null;

  return {
    observedAt: current.observedAt.toISOString(),
    ndxNow: current.ndxClose,
    ndxReferenceHigh,
    drawdownPercent,
    vixNow: current.vixClose,
    vixPercentile,
    ndxObservationCount: window.length,
    vixObservationCount: vixCloses.length,
    decisionInput: {
      drawdownPercent,
      vixPercentile,
      hedgeCoveragePercent
    }
  };
}

export async function deriveHedgeSignalsFromStore(
  store: MarketSignalStore,
  options: DeriveStoredHedgeSignalOptions
): Promise<DerivedHedgeSignals> {
  const source = options.source.trim();
  if (!source) throw new Error('Market data source is required.');

  let asOf: Date;
  if (options.asOf) {
    asOf = parseTimestamp(options.asOf, 'asOf');
  } else {
    const latest = await store.marketSnapshot.findFirst({
      where: { source },
      orderBy: { observedAt: 'desc' },
      select: { observedAt: true }
    });
    if (!latest) throw new Error(`No market history found for source ${source}.`);
    asOf = latest.observedAt;
  }

  const history = await store.marketSnapshot.findMany({
    where: {
      source,
      observedAt: {
        gte: marketSignalWindowStart(asOf),
        lte: asOf
      }
    },
    orderBy: { observedAt: 'asc' },
    select: { observedAt: true, ndxClose: true, vixClose: true }
  });

  return deriveHedgeSignalsFromHistory(history, {
    asOf,
    hedgeCoveragePercent: options.hedgeCoveragePercent
  });
}
