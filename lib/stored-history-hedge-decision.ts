import { createHash } from 'node:crypto';
import { evaluateDecision } from './decision-engine';
import { DecisionConflictError, persistDecision } from './decision-persistence';
import type { DecisionInput } from './decision-schema';
import { deriveHedgeSignalsFromStore, type DerivedHedgeSignals } from './market-signal-derivation';
import { prisma } from './prisma';
import { DEFAULT_STRATEGY_CONFIG, type StrategyConfig } from './strategy-config';

export type StoredHistoryHedgeDecisionOptions = {
  source: string;
  asOf?: string;
  hedgeCoveragePercent?: number | null;
};

export type StoredHistoryHedgeDecisionResult = {
  id: number;
  created: boolean;
  input: DecisionInput;
};

type PersistedDecision = { id: number; input: DecisionInput };

export type StoredHistoryHedgeDecisionDependencies = {
  deriveSignals(options: StoredHistoryHedgeDecisionOptions): Promise<DerivedHedgeSignals>;
  persist(input: DecisionInput): Promise<PersistedDecision>;
  findByFingerprint(inputFingerprint: string): Promise<{ id: number } | null>;
};

function normalizeOptions(value: StoredHistoryHedgeDecisionOptions): StoredHistoryHedgeDecisionOptions {
  const source = value.source?.trim();
  if (!source) throw new Error('Market data source is required.');
  if (source.length > 120) throw new Error('Market data source must not exceed 120 characters.');

  let asOf: string | undefined;
  if (value.asOf != null) {
    const parsed = new Date(value.asOf);
    if (Number.isNaN(parsed.getTime())) throw new Error('asOf must be a valid ISO timestamp.');
    asOf = parsed.toISOString();
  }

  const hedgeCoveragePercent = value.hedgeCoveragePercent ?? null;
  if (
    hedgeCoveragePercent != null
    && (!Number.isFinite(hedgeCoveragePercent) || hedgeCoveragePercent < 0 || hedgeCoveragePercent > 1000)
  ) {
    throw new Error('hedgeCoveragePercent must be between 0 and 1000 when supplied.');
  }

  return { source, ...(asOf ? { asOf } : {}), hedgeCoveragePercent };
}

function strategyFingerprintPayload(config: StrategyConfig) {
  return {
    version: config.version,
    drawdownHoldPercent: config.drawdownHoldPercent,
    drawdownRealizeFirstPercent: config.drawdownRealizeFirstPercent,
    drawdownRealizeSecondPercent: config.drawdownRealizeSecondPercent,
    drawdownCloseMostPercent: config.drawdownCloseMostPercent,
    nearHighPercent: config.nearHighPercent,
    cheapVolatilityPercentile: config.cheapVolatilityPercentile,
    expensiveVolatilityPercentile: config.expensiveVolatilityPercentile,
    targetHedgeCoveragePercent: config.targetHedgeCoveragePercent
  };
}

export function buildStoredHistoryDecisionInput(
  signals: DerivedHedgeSignals,
  source: string,
  config: StrategyConfig = DEFAULT_STRATEGY_CONFIG
): DecisionInput {
  const result = evaluateDecision(signals.decisionInput, config);
  const canonicalFingerprintInput = {
    schemaVersion: 'stored-history-hedge-decision/1.0',
    source,
    observedAt: signals.observedAt,
    ndxNow: signals.ndxNow,
    ndxReferenceHigh: signals.ndxReferenceHigh,
    drawdownPercent: signals.drawdownPercent,
    vixNow: signals.vixNow,
    vixPercentile: signals.vixPercentile,
    hedgeCoveragePercent: signals.decisionInput.hedgeCoveragePercent ?? null,
    strategy: strategyFingerprintPayload(config)
  };
  const inputFingerprint = createHash('sha256')
    .update(JSON.stringify(canonicalFingerprintInput))
    .digest('hex');

  return {
    observedAt: signals.observedAt,
    source,
    inputFingerprint,
    ndxNow: signals.ndxNow,
    ndxHigh2y: signals.ndxReferenceHigh,
    drawdownPercent: signals.drawdownPercent,
    vixNow: signals.vixNow,
    vixPercentile: signals.vixPercentile,
    hedgeCoveragePercent: signals.decisionInput.hedgeCoveragePercent ?? null,
    action: result.action,
    severity: result.severity,
    recommendation: result.recommendation,
    ruleVersion: result.ruleVersion,
    triggeredRules: result.triggeredRules,
    notes: `Derived from stored MarketSnapshot history (${signals.ndxObservationCount} NDX / ${signals.vixObservationCount} VIX observations).`
  };
}

export async function runStoredHistoryHedgeDecisionWithDependencies(
  rawOptions: StoredHistoryHedgeDecisionOptions,
  dependencies: StoredHistoryHedgeDecisionDependencies,
  config: StrategyConfig = DEFAULT_STRATEGY_CONFIG
): Promise<StoredHistoryHedgeDecisionResult> {
  const options = normalizeOptions(rawOptions);
  const signals = await dependencies.deriveSignals(options);
  const input = buildStoredHistoryDecisionInput(signals, options.source, config);

  try {
    const persisted = await dependencies.persist(input);
    return { id: persisted.id, created: true, input: persisted.input };
  } catch (error) {
    if (!(error instanceof DecisionConflictError)) throw error;
    const existing = await dependencies.findByFingerprint(input.inputFingerprint!);
    if (!existing) throw error;
    return { id: existing.id, created: false, input };
  }
}

export async function runStoredHistoryHedgeDecision(
  options: StoredHistoryHedgeDecisionOptions,
  config: StrategyConfig = DEFAULT_STRATEGY_CONFIG
): Promise<StoredHistoryHedgeDecisionResult> {
  return runStoredHistoryHedgeDecisionWithDependencies(options, {
    deriveSignals: request => deriveHedgeSignalsFromStore(prisma, request),
    persist: input => persistDecision(input),
    findByFingerprint: inputFingerprint => prisma.decision.findUnique({
      where: { inputFingerprint },
      select: { id: true }
    })
  }, config);
}
