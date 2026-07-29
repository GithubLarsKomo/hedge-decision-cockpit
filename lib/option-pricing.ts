export type OptionType = 'call' | 'put';

export type EuropeanOptionInput = {
  type: OptionType;
  spot: number;
  strike: number;
  timeToExpiryYears: number;
  volatility: number;
  riskFreeRate: number;
  dividendYield?: number;
};

export type EuropeanOptionResult = {
  price: number;
  intrinsicValue: number;
  timeValue: number;
  delta: number;
  gamma: number;
  vega: number;
};

function normalCdf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

function normalPdf(value: number): number {
  return Math.exp(-0.5 * value * value) / Math.sqrt(2 * Math.PI);
}

function validateInput(input: EuropeanOptionInput): void {
  const finitePositive = [input.spot, input.strike];
  if (finitePositive.some(value => !Number.isFinite(value) || value <= 0)) {
    throw new Error('Spot and strike must be finite positive numbers.');
  }
  if (!Number.isFinite(input.timeToExpiryYears) || input.timeToExpiryYears < 0) {
    throw new Error('Time to expiry must be a finite non-negative number.');
  }
  if (!Number.isFinite(input.volatility) || input.volatility < 0) {
    throw new Error('Volatility must be a finite non-negative number.');
  }
  if (!Number.isFinite(input.riskFreeRate) || !Number.isFinite(input.dividendYield ?? 0)) {
    throw new Error('Rates must be finite numbers.');
  }
}

export function priceEuropeanOption(input: EuropeanOptionInput): EuropeanOptionResult {
  validateInput(input);
  const dividendYield = input.dividendYield ?? 0;
  const intrinsicValue = input.type === 'call'
    ? Math.max(input.spot - input.strike, 0)
    : Math.max(input.strike - input.spot, 0);

  if (input.timeToExpiryYears === 0 || input.volatility === 0) {
    const discountedSpot = input.spot * Math.exp(-dividendYield * input.timeToExpiryYears);
    const discountedStrike = input.strike * Math.exp(-input.riskFreeRate * input.timeToExpiryYears);
    const deterministicPrice = input.type === 'call'
      ? Math.max(discountedSpot - discountedStrike, 0)
      : Math.max(discountedStrike - discountedSpot, 0);
    const delta = input.type === 'call'
      ? (discountedSpot > discountedStrike ? Math.exp(-dividendYield * input.timeToExpiryYears) : 0)
      : (discountedSpot < discountedStrike ? -Math.exp(-dividendYield * input.timeToExpiryYears) : 0);
    return {
      price: deterministicPrice,
      intrinsicValue,
      timeValue: Math.max(deterministicPrice - intrinsicValue, 0),
      delta,
      gamma: 0,
      vega: 0
    };
  }

  const sqrtTime = Math.sqrt(input.timeToExpiryYears);
  const d1 = (
    Math.log(input.spot / input.strike)
    + (input.riskFreeRate - dividendYield + 0.5 * input.volatility ** 2) * input.timeToExpiryYears
  ) / (input.volatility * sqrtTime);
  const d2 = d1 - input.volatility * sqrtTime;
  const discountedSpot = input.spot * Math.exp(-dividendYield * input.timeToExpiryYears);
  const discountedStrike = input.strike * Math.exp(-input.riskFreeRate * input.timeToExpiryYears);

  const price = input.type === 'call'
    ? discountedSpot * normalCdf(d1) - discountedStrike * normalCdf(d2)
    : discountedStrike * normalCdf(-d2) - discountedSpot * normalCdf(-d1);
  const delta = input.type === 'call'
    ? Math.exp(-dividendYield * input.timeToExpiryYears) * normalCdf(d1)
    : Math.exp(-dividendYield * input.timeToExpiryYears) * (normalCdf(d1) - 1);
  const gamma = Math.exp(-dividendYield * input.timeToExpiryYears) * normalPdf(d1)
    / (input.spot * input.volatility * sqrtTime);
  const vega = discountedSpot * normalPdf(d1) * sqrtTime;

  return {
    price,
    intrinsicValue,
    timeValue: Math.max(price - intrinsicValue, 0),
    delta,
    gamma,
    vega
  };
}

export function optionPositionMarketValueEur(params: {
  optionPrice: number;
  contracts: number;
  contractMultiplier?: number;
  fxRateToEur?: number;
}): number {
  const multiplier = params.contractMultiplier ?? 100;
  const fxRate = params.fxRateToEur ?? 1;
  if (![params.optionPrice, params.contracts, multiplier, fxRate].every(Number.isFinite)) {
    throw new Error('Position parameters must be finite numbers.');
  }
  if (params.optionPrice < 0 || params.contracts < 0 || multiplier <= 0 || fxRate <= 0) {
    throw new Error('Position parameters are outside their allowed ranges.');
  }
  return params.optionPrice * params.contracts * multiplier * fxRate;
}
