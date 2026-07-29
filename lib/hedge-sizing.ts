export type ContractRounding = 'down' | 'nearest' | 'up';

export type HedgeSizingInput = {
  portfolioValueEur: number;
  targetCoverageRatio: number;
  underlyingPrice: number;
  optionDelta: number;
  contractMultiplier?: number;
  eurPerQuoteCurrency?: number;
  rounding?: ContractRounding;
  maxContracts?: number;
};

export type HedgeSizingResult = {
  targetHedgeNotionalEur: number;
  hedgeNotionalPerContractEur: number;
  rawContracts: number;
  recommendedContracts: number;
  achievedHedgeNotionalEur: number;
  achievedCoverageRatio: number;
  residualNotionalEur: number;
  overhedgeNotionalEur: number;
  capped: boolean;
};

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be finite.`);
  }
}

function roundContracts(value: number, rounding: ContractRounding): number {
  if (rounding === 'down') return Math.floor(value);
  if (rounding === 'up') return Math.ceil(value);
  return Math.round(value);
}

export function recommendHedgeContracts(input: HedgeSizingInput): HedgeSizingResult {
  const multiplier = input.contractMultiplier ?? 100;
  const eurPerQuoteCurrency = input.eurPerQuoteCurrency ?? 1;
  const rounding = input.rounding ?? 'nearest';

  assertFinite('portfolioValueEur', input.portfolioValueEur);
  assertFinite('targetCoverageRatio', input.targetCoverageRatio);
  assertFinite('underlyingPrice', input.underlyingPrice);
  assertFinite('optionDelta', input.optionDelta);
  assertFinite('contractMultiplier', multiplier);
  assertFinite('eurPerQuoteCurrency', eurPerQuoteCurrency);

  if (input.portfolioValueEur <= 0) throw new Error('portfolioValueEur must be positive.');
  if (input.targetCoverageRatio < 0 || input.targetCoverageRatio > 1) {
    throw new Error('targetCoverageRatio must be between 0 and 1.');
  }
  if (input.underlyingPrice <= 0) throw new Error('underlyingPrice must be positive.');
  if (input.optionDelta >= 0 || input.optionDelta < -1) {
    throw new Error('optionDelta must be between -1 and 0 for a protective put.');
  }
  if (multiplier <= 0) throw new Error('contractMultiplier must be positive.');
  if (eurPerQuoteCurrency <= 0) throw new Error('eurPerQuoteCurrency must be positive.');
  if (input.maxContracts != null) {
    if (!Number.isInteger(input.maxContracts) || input.maxContracts < 0) {
      throw new Error('maxContracts must be a non-negative integer.');
    }
  }

  const targetHedgeNotionalEur = input.portfolioValueEur * input.targetCoverageRatio;
  const hedgeNotionalPerContractEur =
    input.underlyingPrice * multiplier * -input.optionDelta * eurPerQuoteCurrency;
  const rawContracts = targetHedgeNotionalEur / hedgeNotionalPerContractEur;
  const roundedContracts = roundContracts(rawContracts, rounding);
  const recommendedContracts = input.maxContracts == null
    ? roundedContracts
    : Math.min(roundedContracts, input.maxContracts);
  const achievedHedgeNotionalEur = recommendedContracts * hedgeNotionalPerContractEur;
  const achievedCoverageRatio = achievedHedgeNotionalEur / input.portfolioValueEur;
  const coverageDifferenceEur = targetHedgeNotionalEur - achievedHedgeNotionalEur;

  return {
    targetHedgeNotionalEur,
    hedgeNotionalPerContractEur,
    rawContracts,
    recommendedContracts,
    achievedHedgeNotionalEur,
    achievedCoverageRatio,
    residualNotionalEur: Math.max(0, coverageDifferenceEur),
    overhedgeNotionalEur: Math.max(0, -coverageDifferenceEur),
    capped: input.maxContracts != null && roundedContracts > input.maxContracts
  };
}
