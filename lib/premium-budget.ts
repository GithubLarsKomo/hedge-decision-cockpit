export type PremiumBudgetInput = {
  portfolioMarketValueEur: number;
  annualPremiumBudgetPercent: number;
  premiumBudgetUsedEur?: number;
  requestedContracts: number;
  optionPremium: number;
  contractMultiplier?: number;
  quoteCurrencyToEur?: number;
  transactionCostPerContractEur?: number;
};

export type PremiumBudgetAllocation = {
  annualBudgetEur: number;
  remainingBudgetEur: number;
  costPerContractEur: number;
  maximumAffordableContracts: number;
  approvedContracts: number;
  estimatedPremiumCostEur: number;
  remainingBudgetAfterTradeEur: number;
  budgetLimited: boolean;
};

function requireFiniteNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be finite and non-negative.`);
  }
}

function requirePositive(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be finite and greater than zero.`);
  }
}

export function allocatePremiumBudget(input: PremiumBudgetInput): PremiumBudgetAllocation {
  requireFiniteNonNegative(input.portfolioMarketValueEur, 'portfolioMarketValueEur');
  requireFiniteNonNegative(input.annualPremiumBudgetPercent, 'annualPremiumBudgetPercent');
  requireFiniteNonNegative(input.premiumBudgetUsedEur ?? 0, 'premiumBudgetUsedEur');
  requireFiniteNonNegative(input.optionPremium, 'optionPremium');
  requireFiniteNonNegative(input.transactionCostPerContractEur ?? 0, 'transactionCostPerContractEur');

  if (!Number.isInteger(input.requestedContracts) || input.requestedContracts < 0) {
    throw new Error('requestedContracts must be a non-negative integer.');
  }

  const contractMultiplier = input.contractMultiplier ?? 100;
  const quoteCurrencyToEur = input.quoteCurrencyToEur ?? 1;
  requirePositive(contractMultiplier, 'contractMultiplier');
  requirePositive(quoteCurrencyToEur, 'quoteCurrencyToEur');

  const annualBudgetEur = input.portfolioMarketValueEur * input.annualPremiumBudgetPercent / 100;
  const remainingBudgetEur = Math.max(0, annualBudgetEur - (input.premiumBudgetUsedEur ?? 0));
  const costPerContractEur = input.optionPremium * contractMultiplier * quoteCurrencyToEur
    + (input.transactionCostPerContractEur ?? 0);

  const maximumAffordableContracts = costPerContractEur === 0
    ? input.requestedContracts
    : Math.floor(remainingBudgetEur / costPerContractEur);
  const approvedContracts = Math.min(input.requestedContracts, maximumAffordableContracts);
  const estimatedPremiumCostEur = approvedContracts * costPerContractEur;

  return {
    annualBudgetEur,
    remainingBudgetEur,
    costPerContractEur,
    maximumAffordableContracts,
    approvedContracts,
    estimatedPremiumCostEur,
    remainingBudgetAfterTradeEur: remainingBudgetEur - estimatedPremiumCostEur,
    budgetLimited: approvedContracts < input.requestedContracts
  };
}
