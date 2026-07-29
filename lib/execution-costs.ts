export type TradeSide = 'buy' | 'sell';

export type ExecutionCostInput = {
  side: TradeSide;
  theoreticalPrice: number;
  bid?: number | null;
  ask?: number | null;
  contracts: number;
  contractMultiplier?: number;
  slippageBps?: number;
  commissionPerContract?: number;
  fxRateToEur?: number;
};

export type ExecutionCostResult = {
  referencePrice: number;
  executedPrice: number;
  grossValueEur: number;
  spreadCostEur: number;
  slippageCostEur: number;
  commissionEur: number;
  totalExecutionCostEur: number;
  netCashFlowEur: number;
};

function validate(input: ExecutionCostInput): void {
  const multiplier = input.contractMultiplier ?? 100;
  const fxRate = input.fxRateToEur ?? 1;
  const slippageBps = input.slippageBps ?? 0;
  const commission = input.commissionPerContract ?? 0;

  if (!Number.isFinite(input.theoreticalPrice) || input.theoreticalPrice < 0) {
    throw new Error('Theoretical price must be a finite non-negative number.');
  }
  if (!Number.isInteger(input.contracts) || input.contracts <= 0) {
    throw new Error('Contracts must be a positive integer.');
  }
  if (!Number.isFinite(multiplier) || multiplier <= 0 || !Number.isFinite(fxRate) || fxRate <= 0) {
    throw new Error('Multiplier and FX rate must be finite positive numbers.');
  }
  if (!Number.isFinite(slippageBps) || slippageBps < 0 || !Number.isFinite(commission) || commission < 0) {
    throw new Error('Slippage and commission must be finite non-negative numbers.');
  }
  for (const quote of [input.bid, input.ask]) {
    if (quote != null && (!Number.isFinite(quote) || quote < 0)) {
      throw new Error('Bid and ask must be finite non-negative numbers when supplied.');
    }
  }
  if (input.bid != null && input.ask != null && input.bid > input.ask) {
    throw new Error('Bid must not exceed ask.');
  }
}

export function estimateExecution(input: ExecutionCostInput): ExecutionCostResult {
  validate(input);
  const multiplier = input.contractMultiplier ?? 100;
  const fxRate = input.fxRateToEur ?? 1;
  const slippageBps = input.slippageBps ?? 0;
  const commissionPerContract = input.commissionPerContract ?? 0;
  const referencePrice = input.side === 'buy'
    ? input.ask ?? input.theoreticalPrice
    : input.bid ?? input.theoreticalPrice;
  const direction = input.side === 'buy' ? 1 : -1;
  const slippagePerUnit = referencePrice * slippageBps / 10_000;
  const executedPrice = Math.max(referencePrice + direction * slippagePerUnit, 0);
  const units = input.contracts * multiplier;
  const grossValueEur = executedPrice * units * fxRate;
  const theoreticalValueEur = input.theoreticalPrice * units * fxRate;
  const quotedValueEur = referencePrice * units * fxRate;
  const spreadCostEur = input.side === 'buy'
    ? Math.max(quotedValueEur - theoreticalValueEur, 0)
    : Math.max(theoreticalValueEur - quotedValueEur, 0);
  const slippageCostEur = Math.abs(executedPrice - referencePrice) * units * fxRate;
  const commissionEur = commissionPerContract * input.contracts;
  const totalExecutionCostEur = spreadCostEur + slippageCostEur + commissionEur;
  const netCashFlowEur = input.side === 'buy'
    ? -(grossValueEur + commissionEur)
    : grossValueEur - commissionEur;

  return {
    referencePrice,
    executedPrice,
    grossValueEur,
    spreadCostEur,
    slippageCostEur,
    commissionEur,
    totalExecutionCostEur,
    netCashFlowEur
  };
}

export type StrategyExecutionLeg = ExecutionCostInput & { label: string };

export function estimateStrategyExecution(legs: StrategyExecutionLeg[]) {
  if (!legs.length) throw new Error('At least one execution leg is required.');
  const results = legs.map(leg => ({ label: leg.label, ...estimateExecution(leg) }));
  return {
    legs: results,
    totalExecutionCostEur: results.reduce((sum, result) => sum + result.totalExecutionCostEur, 0),
    netCashFlowEur: results.reduce((sum, result) => sum + result.netCashFlowEur, 0)
  };
}
