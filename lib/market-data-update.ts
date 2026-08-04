import { FRED_MARKET_SOURCE, syncFredMarketData, type FredSyncOptions, type FredSyncResult } from './fred-market-data';
import { prisma } from './prisma';
import {
  runStoredHistoryHedgeDecision,
  type StoredHistoryHedgeDecisionResult
} from './stored-history-hedge-decision';

export type MarketDataUpdateOptions = FredSyncOptions & {
  hedgeCoveragePercent?: number | null;
  createDecision?: boolean;
};

export type MarketDataUpdateResult = {
  sync: FredSyncResult;
  decision: null | {
    id: number;
    created: boolean;
    action: string;
    severity: string;
    ruleVersion: string;
    inputFingerprint: string | null;
  };
};

export type MarketDataUpdateDependencies = {
  sync(options: FredSyncOptions): Promise<FredSyncResult>;
  decide(options: { source: string; hedgeCoveragePercent?: number | null }): Promise<StoredHistoryHedgeDecisionResult>;
};

export async function runMarketDataUpdateWithDependencies(
  options: MarketDataUpdateOptions,
  dependencies: MarketDataUpdateDependencies
): Promise<MarketDataUpdateResult> {
  const sync = await dependencies.sync({
    ...(options.observationStart ? { observationStart: options.observationStart } : {}),
    ...(options.observationEnd ? { observationEnd: options.observationEnd } : {})
  });

  if (options.createDecision === false) return { sync, decision: null };

  const result = await dependencies.decide({
    source: sync.source || FRED_MARKET_SOURCE,
    hedgeCoveragePercent: options.hedgeCoveragePercent ?? null
  });

  return {
    sync,
    decision: {
      id: result.id,
      created: result.created,
      action: result.input.action,
      severity: result.input.severity,
      ruleVersion: result.input.ruleVersion,
      inputFingerprint: result.input.inputFingerprint ?? null
    }
  };
}

export async function runMarketDataUpdate(
  options: MarketDataUpdateOptions = {}
): Promise<MarketDataUpdateResult> {
  return runMarketDataUpdateWithDependencies(options, {
    sync: request => syncFredMarketData(prisma, request),
    decide: request => runStoredHistoryHedgeDecision(request)
  });
}
