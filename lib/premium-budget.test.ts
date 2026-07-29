import assert from 'node:assert/strict';
import test from 'node:test';
import { allocatePremiumBudget } from './premium-budget';

test('approves requested contracts when budget is sufficient', () => {
  const result = allocatePremiumBudget({
    portfolioMarketValueEur: 1000000,
    annualPremiumBudgetPercent: 2,
    premiumBudgetUsedEur: 2000,
    requestedContracts: 5,
    optionPremium: 30,
    contractMultiplier: 100,
    quoteCurrencyToEur: 0.9,
    transactionCostPerContractEur: 10
  });
  assert.equal(result.annualBudgetEur, 20000);
  assert.equal(result.remainingBudgetEur, 18000);
  assert.equal(result.costPerContractEur, 2710);
  assert.equal(result.approvedContracts, 5);
  assert.equal(result.estimatedPremiumCostEur, 13550);
  assert.equal(result.remainingBudgetAfterTradeEur, 4450);
  assert.equal(result.budgetLimited, false);
});

test('caps contracts at the affordable amount', () => {
  const result = allocatePremiumBudget({
    portfolioMarketValueEur: 500000,
    annualPremiumBudgetPercent: 1,
    premiumBudgetUsedEur: 1000,
    requestedContracts: 10,
    optionPremium: 20
  });
  assert.equal(result.remainingBudgetEur, 4000);
  assert.equal(result.maximumAffordableContracts, 2);
  assert.equal(result.approvedContracts, 2);
  assert.equal(result.budgetLimited, true);
});

test('returns zero contracts when budget is exhausted', () => {
  const result = allocatePremiumBudget({
    portfolioMarketValueEur: 100000,
    annualPremiumBudgetPercent: 1,
    premiumBudgetUsedEur: 1500,
    requestedContracts: 3,
    optionPremium: 5
  });
  assert.equal(result.remainingBudgetEur, 0);
  assert.equal(result.approvedContracts, 0);
});

test('handles zero-cost contracts without division by zero', () => {
  const result = allocatePremiumBudget({
    portfolioMarketValueEur: 100000,
    annualPremiumBudgetPercent: 0,
    requestedContracts: 4,
    optionPremium: 0
  });
  assert.equal(result.maximumAffordableContracts, 4);
  assert.equal(result.approvedContracts, 4);
});

test('rejects invalid contract counts and conversion factors', () => {
  assert.throws(() => allocatePremiumBudget({
    portfolioMarketValueEur: 100000,
    annualPremiumBudgetPercent: 1,
    requestedContracts: 1.5,
    optionPremium: 5
  }), /requestedContracts/);
  assert.throws(() => allocatePremiumBudget({
    portfolioMarketValueEur: 100000,
    annualPremiumBudgetPercent: 1,
    requestedContracts: 1,
    optionPremium: 5,
    quoteCurrencyToEur: 0
  }), /quoteCurrencyToEur/);
});
