import { validatePortfolioSnapshot, type PortfolioSnapshot } from './portfolio-snapshot';
import type { PortfolioAllocationResult } from './portfolio-allocation';

export type HedgeContext = {
  risk_regime: string;
  recommended_hedge_ratio: number;
  hedge_notional_eur: number;
  confidence: string;
  reasons: string[];
  [key: string]: unknown;
};

export type ExtraCashAllocation = {
  exposureId: string;
  remainingPositiveGap: number;
  additionalPurchase: number;
};

export type PortfolioDecisionVariant = {
  variantId:
    | 'contribution-only'
    | 'deploy-extra-cash'
    | 'deploy-extra-cash-with-hedge-context';
  availableAdditionalCash: number;
  additionalCashDeployed: number;
  residualAdditionalCash: number;
  allocations: ExtraCashAllocation[];
  hedgeContext?: HedgeContext;
};

export type PortfolioDecisionVariantsResult = {
  snapshotId: string;
  revision: number;
  currency: string;
  variants: PortfolioDecisionVariant[];
};

const toCents = (value: number): number => Math.round(value * 100);
const fromCents = (value: number): number => value / 100;

function cloneHedgeContext(value: unknown): HedgeContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('hedge context must be an object');
  }

  const context = value as Record<string, unknown>;
  if (typeof context.risk_regime !== 'string' || context.risk_regime.length === 0) {
    throw new Error('hedge context risk_regime is required');
  }
  if (
    typeof context.recommended_hedge_ratio !== 'number' ||
    !Number.isFinite(context.recommended_hedge_ratio) ||
    context.recommended_hedge_ratio < 0 ||
    context.recommended_hedge_ratio > 1
  ) {
    throw new Error('hedge context recommended_hedge_ratio must be between 0 and 1');
  }
  if (
    typeof context.hedge_notional_eur !== 'number' ||
    !Number.isFinite(context.hedge_notional_eur) ||
    context.hedge_notional_eur < 0
  ) {
    throw new Error('hedge context hedge_notional_eur must be non-negative');
  }
  if (typeof context.confidence !== 'string' || context.confidence.length === 0) {
    throw new Error('hedge context confidence is required');
  }
  if (
    !Array.isArray(context.reasons) ||
    !context.reasons.every((reason) => typeof reason === 'string')
  ) {
    throw new Error('hedge context reasons must be a string array');
  }

  return JSON.parse(JSON.stringify(context)) as HedgeContext;
}

function allocateProportionally(gapsCents: number[], availableCents: number): number[] {
  const totalGapCents = gapsCents.reduce((sum, gap) => sum + gap, 0);
  const allocatableCents = Math.min(availableCents, totalGapCents);
  const allocations = new Array<number>(gapsCents.length).fill(0);

  if (allocatableCents === 0 || totalGapCents === 0) {
    return allocations;
  }

  const provisional = gapsCents.map((gap, index) => {
    const exact = (allocatableCents * gap) / totalGapCents;
    const floor = Math.min(gap, Math.floor(exact));
    allocations[index] = floor;
    return { index, remainder: exact - floor };
  });

  let remaining = allocatableCents - allocations.reduce((sum, amount) => sum + amount, 0);
  provisional
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
    .forEach(({ index }) => {
      if (remaining > 0 && allocations[index] < gapsCents[index]) {
        allocations[index] += 1;
        remaining -= 1;
      }
    });

  return allocations;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)])
    );
  }
  return value;
}

export function buildPortfolioDecisionVariants(
  snapshotValue: unknown,
  allocation: PortfolioAllocationResult,
  hedgeContextValue?: unknown
): PortfolioDecisionVariantsResult {
  const snapshot: PortfolioSnapshot = validatePortfolioSnapshot(snapshotValue);
  if (allocation.currency !== snapshot.portfolio.currency) {
    throw new Error('allocation currency does not match portfolio snapshot');
  }

  const availableCents = toCents(snapshot.portfolio.additional_cash_available);
  const remainingGapCents = allocation.exposures.map((row) =>
    Math.max(0, toCents(row.gapAmount) - toCents(row.contributionAllocation))
  );
  const extraAllocationsCents = allocateProportionally(remainingGapCents, availableCents);
  const deployedCents = extraAllocationsCents.reduce((sum, amount) => sum + amount, 0);

  const makeAllocations = (amountsCents: number[]): ExtraCashAllocation[] =>
    allocation.exposures.map((row, index) => ({
      exposureId: row.exposureId,
      remainingPositiveGap: fromCents(remainingGapCents[index]),
      additionalPurchase: fromCents(amountsCents[index])
    }));

  const contributionOnly: PortfolioDecisionVariant = {
    variantId: 'contribution-only',
    availableAdditionalCash: fromCents(availableCents),
    additionalCashDeployed: 0,
    residualAdditionalCash: fromCents(availableCents),
    allocations: makeAllocations(new Array<number>(remainingGapCents.length).fill(0))
  };

  const deployExtraCash: PortfolioDecisionVariant = {
    variantId: 'deploy-extra-cash',
    availableAdditionalCash: fromCents(availableCents),
    additionalCashDeployed: fromCents(deployedCents),
    residualAdditionalCash: fromCents(availableCents - deployedCents),
    allocations: makeAllocations(extraAllocationsCents)
  };

  const variants: PortfolioDecisionVariant[] = [contributionOnly, deployExtraCash];

  if (hedgeContextValue !== undefined) {
    variants.push({
      ...deployExtraCash,
      variantId: 'deploy-extra-cash-with-hedge-context',
      allocations: deployExtraCash.allocations.map((row) => ({ ...row })),
      hedgeContext: cloneHedgeContext(hedgeContextValue)
    });
  }

  return {
    snapshotId: snapshot.snapshot_id,
    revision: snapshot.revision,
    currency: snapshot.portfolio.currency,
    variants
  };
}

export function stableSerializePortfolioDecisionVariants(
  value: PortfolioDecisionVariantsResult
): string {
  return JSON.stringify(stableValue(value));
}
