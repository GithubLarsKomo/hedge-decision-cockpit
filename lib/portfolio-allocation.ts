import { validatePortfolioSnapshot, type PortfolioSnapshot } from './portfolio-snapshot';

export type ExposureDrift = {
  exposureId: string;
  targetWeight: number;
  currentWeight: number;
  driftPercentagePoints: number;
  relativeDrift: number | null;
  targetAmount: number;
  currentAmount: number;
  gapAmount: number;
  contributionAllocation: number;
};

export type PortfolioAllocationResult = {
  currency: string;
  monthlyContribution: number;
  allocatedContribution: number;
  residualContribution: number;
  totalPositiveGap: number;
  exposures: ExposureDrift[];
};

const toCents = (value: number): number => Math.round(value * 100);
const fromCents = (value: number): number => value / 100;
const normalizeMetric = (value: number): number => Math.round(value * 1e12) / 1e12;

export function computeMonthlyPortfolioAllocation(value: unknown): PortfolioAllocationResult {
  const snapshot: PortfolioSnapshot = validatePortfolioSnapshot(value);
  const marketValueCents = toCents(snapshot.portfolio.market_value);
  const contributionCents = toCents(snapshot.portfolio.monthly_contribution);

  const base = snapshot.exposures.map((exposure) => {
    const targetAmountCents = Math.round(marketValueCents * exposure.target_weight);
    const currentAmountCents = Math.round(marketValueCents * exposure.current_weight);
    const gapCents = targetAmountCents - currentAmountCents;

    return {
      exposure,
      targetAmountCents,
      currentAmountCents,
      gapCents,
      positiveGapCents: Math.max(0, gapCents)
    };
  });

  const totalPositiveGapCents = base.reduce((sum, row) => sum + row.positiveGapCents, 0);
  const allocatableCents = Math.min(contributionCents, totalPositiveGapCents);
  const allocations = new Array<number>(base.length).fill(0);

  if (allocatableCents > 0 && totalPositiveGapCents > 0) {
    const provisional = base.map((row, index) => {
      const exact = (allocatableCents * row.positiveGapCents) / totalPositiveGapCents;
      const floor = Math.min(row.positiveGapCents, Math.floor(exact));
      allocations[index] = floor;
      return { index, remainder: exact - floor };
    });

    let remaining = allocatableCents - allocations.reduce((sum, amount) => sum + amount, 0);
    provisional
      .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
      .forEach(({ index }) => {
        if (remaining > 0 && allocations[index] < base[index].positiveGapCents) {
          allocations[index] += 1;
          remaining -= 1;
        }
      });
  }

  const exposures = base.map((row, index): ExposureDrift => ({
    exposureId: row.exposure.exposure_id,
    targetWeight: row.exposure.target_weight,
    currentWeight: row.exposure.current_weight,
    driftPercentagePoints: normalizeMetric(
      (row.exposure.current_weight - row.exposure.target_weight) * 100
    ),
    relativeDrift:
      row.exposure.target_weight === 0
        ? null
        : normalizeMetric(
            (row.exposure.current_weight - row.exposure.target_weight) /
              row.exposure.target_weight
          ),
    targetAmount: fromCents(row.targetAmountCents),
    currentAmount: fromCents(row.currentAmountCents),
    gapAmount: fromCents(row.gapCents),
    contributionAllocation: fromCents(allocations[index])
  }));

  const allocatedCents = allocations.reduce((sum, amount) => sum + amount, 0);

  return {
    currency: snapshot.portfolio.currency,
    monthlyContribution: fromCents(contributionCents),
    allocatedContribution: fromCents(allocatedCents),
    residualContribution: fromCents(contributionCents - allocatedCents),
    totalPositiveGap: fromCents(totalPositiveGapCents),
    exposures
  };
}
