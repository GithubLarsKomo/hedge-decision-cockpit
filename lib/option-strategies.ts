import { EuropeanOptionInput, priceEuropeanOption } from './option-pricing';

export type StrategyLeg = EuropeanOptionInput & {
  quantity: number;
  contractMultiplier?: number;
};

export type StrategyValuation = {
  marketValue: number;
  netDelta: number;
  netGamma: number;
  netVega: number;
  legValues: number[];
};

export function valueOptionStrategy(legs: StrategyLeg[]): StrategyValuation {
  if (!legs.length) throw new Error('At least one strategy leg is required.');

  let marketValue = 0;
  let netDelta = 0;
  let netGamma = 0;
  let netVega = 0;
  const legValues: number[] = [];

  for (const leg of legs) {
    if (!Number.isFinite(leg.quantity) || leg.quantity === 0) {
      throw new Error('Leg quantity must be a finite non-zero number.');
    }
    const multiplier = leg.contractMultiplier ?? 100;
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      throw new Error('Contract multiplier must be a finite positive number.');
    }

    const result = priceEuropeanOption(leg);
    const scale = leg.quantity * multiplier;
    const legValue = result.price * scale;
    legValues.push(legValue);
    marketValue += legValue;
    netDelta += result.delta * scale;
    netGamma += result.gamma * scale;
    netVega += result.vega * scale;
  }

  return { marketValue, netDelta, netGamma, netVega, legValues };
}

export function longPut(params: Omit<EuropeanOptionInput, 'type'> & { contracts: number; contractMultiplier?: number }): StrategyValuation {
  return valueOptionStrategy([{ ...params, type: 'put', quantity: params.contracts }]);
}

export function putSpread(params: Omit<EuropeanOptionInput, 'type' | 'strike'> & {
  longStrike: number;
  shortStrike: number;
  contracts: number;
  contractMultiplier?: number;
}): StrategyValuation {
  if (params.longStrike <= params.shortStrike) throw new Error('Long put strike must exceed short put strike.');
  const common = {
    spot: params.spot,
    timeToExpiryYears: params.timeToExpiryYears,
    volatility: params.volatility,
    riskFreeRate: params.riskFreeRate,
    dividendYield: params.dividendYield,
    contractMultiplier: params.contractMultiplier
  };
  return valueOptionStrategy([
    { ...common, type: 'put', strike: params.longStrike, quantity: params.contracts },
    { ...common, type: 'put', strike: params.shortStrike, quantity: -params.contracts }
  ]);
}

export function collar(params: Omit<EuropeanOptionInput, 'type' | 'strike'> & {
  putStrike: number;
  callStrike: number;
  contracts: number;
  contractMultiplier?: number;
}): StrategyValuation {
  if (params.callStrike <= params.putStrike) throw new Error('Call strike must exceed put strike.');
  const common = {
    spot: params.spot,
    timeToExpiryYears: params.timeToExpiryYears,
    volatility: params.volatility,
    riskFreeRate: params.riskFreeRate,
    dividendYield: params.dividendYield,
    contractMultiplier: params.contractMultiplier
  };
  return valueOptionStrategy([
    { ...common, type: 'put', strike: params.putStrike, quantity: params.contracts },
    { ...common, type: 'call', strike: params.callStrike, quantity: -params.contracts }
  ]);
}
