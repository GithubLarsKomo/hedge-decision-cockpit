import { computeMonthlyPortfolioAllocation, type PortfolioAllocationResult } from './portfolio-allocation';
import { validatePortfolioSnapshot, type PortfolioSnapshot } from './portfolio-snapshot';

export type HedgeContext = {
  risk_regime: string;
  recommended_hedge_ratio: number;
  hedge_notional_eur: number;
  confidence: string;
  reasons: string[];
  [key: string]: unknown;
};

export type ExtraCashExposureAllocation = {
  exposureId: string;
  remainingPositiveGap: number;
  additionalPurchaseAllocation: number;
};

export type ExtraCashVariant = {
  variantId: 'contribution-only' | 'deploy-extra-cash' | 'deploy-extra-cash-with-hedge-context';
  additionalCashAvailable: number;
  additionalCashAllocated: number;
  residualAdditionalCash: number;
  exposures: ExtraCashExposureAllocation[];
  hedgeContext?: HedgeContext;
};

export type ExtraCashVariantsResult = {
  snapshotId: string;
  revision: number;
  currency: string;
  variants: ExtraCashVariant[];
};

const toCents = (value: number): number => Math.round(value * 100);
const fromCents = (value: number): number => value / 100;

function allocateProportionally(gaps: number[], availableCents: number): number[] {
  const positiveGapCents = gaps.map((gap) => Math.max(0, toCents(gap)));
  const totalGapCents = positiveGapCents.reduce((sum, gap) => sum + gap, 0);
  const allocatableCents = Math.min(Math.max(0, availableCents), totalGapCents);
  const allocations = new Array<number>(gaps.length).fill(0);

  if (allocatableCents === 0 || totalGapCents === 0) return allocations;

  const provisional = positiveGapCents.map((gap, index) => {
    const exact = (allocatableCents * gap) / totalGapCents;
    const floor = Math.min(gap, Math.floor(exact));
    allocations[index] = floor;
    return { index, remainder: exact - floor };
  });

  let remaining = allocatableCents - allocations.reduce((sum, amount) => sum + amount, 0);
  provisional
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
    .forEach(({ index }) => {
      if (remaining > 0 && allocations[index] < positiveGapCents[index]) {
        allocations[index] += 1;
        remaining -= 1;
      }
    });

  return allocations;
}

function buildDeploymentVariant(
  variantId: ExtraCashVariant['variantId'],
  snapshot: PortfolioSnapshot,
  allocation: PortfolioAllocationResult,
  hedgeContext?: HedgeContext
): ExtraCashVariant {
  const remainingGaps = allocation.exposures.map((exposure) =>
    Math.max(0, exposure.gapAmount - exposure.contributionAllocation)
  );
  const availableCents = toCents(snapshot.portfolio.additional_cash_available);
  const allocations = allocateProportionally(remainingGaps, availableCents);
  const allocatedCents = allocations.reduce((sum, amount) => sum + amount, 0);

  return {
    variantId,
    additionalCashAvailable: fromCents(availableCents),
    additionalCashAllocated: fromCents(allocatedCents),
    residualAdditionalCash: fromCents(availableCents - allocatedCents),
    exposures: allocation.exposures.map((exposure, index) => ({
      exposureId: exposure.exposureId,
      remainingPositiveGap: fromCents(toCents(remainingGaps[index])),
      additionalPurchaseAllocation: fromCents(allocations[index])
    })),
    ...(hedgeContext ? { hedgeContext } : {})
  };
}

export function proposeExtraCashVariants(
  snapshotValue: unknown,
  allocationValue?: PortfolioAllocationResult,
  hedgeContext?: HedgeContext
): ExtraCashVariantsResult {
  const snapshot = validatePortfolioSnapshot(snapshotValue);
  const allocation = allocationValue ?? computeMonthlyPortfolioAllocation(snapshot);

  const contributionOnly: ExtraCashVariant = {
    variantId: 'contribution-only',
    additionalCashAvailable: snapshot.portfolio.additional_cash_available,
    additionalCashAllocated: 0,
    residualAdditionalCash: snapshot.portfolio.additional_cash_available,
    exposures: allocation.exposures.map((exposure) => ({
      exposureId: exposure.exposureId,
      remainingPositiveGap: Math.max(0, exposure.gapAmount - exposure.contributionAllocation),
      additionalPurchaseAllocation: 0
    }))
  };

  const variants: ExtraCashVariant[] = [
    contributionOnly,
    buildDeploymentVariant('deploy-extra-cash', snapshot, allocation)
  ];

  if (hedgeContext) {
    variants.push(
      buildDeploymentVariant('deploy-extra-cash-with-hedge-context', snapshot, allocation, hedgeContext)
    );
  }

  return {
    snapshotId: snapshot.snapshot_id,
    revision: snapshot.revision,
    currency: snapshot.portfolio.currency,
    variants
  };
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortJson(child)])
    );
  }
  return value;
}

export function serializeExtraCashVariants(value: ExtraCashVariantsResult): string {
  return JSON.stringify(sortJson(value));
}
