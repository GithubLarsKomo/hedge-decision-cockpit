export type OptionLiquidityQuote = {
  symbol: string;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
};

export type LiquidityFilterConfig = {
  maximumRelativeSpreadPercent: number;
  minimumVolume: number;
  minimumOpenInterest: number;
};

export type LiquidityAssessment = OptionLiquidityQuote & {
  midpoint: number;
  absoluteSpread: number;
  relativeSpreadPercent: number;
};

function requireNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be a finite non-negative number.`);
}

export function assessLiquidity(quote: OptionLiquidityQuote): LiquidityAssessment {
  if (!quote.symbol.trim()) throw new Error('symbol must not be empty.');
  requireNonNegative(quote.bid, 'bid');
  requireNonNegative(quote.ask, 'ask');
  requireNonNegative(quote.volume, 'volume');
  requireNonNegative(quote.openInterest, 'openInterest');
  if (!Number.isInteger(quote.volume) || !Number.isInteger(quote.openInterest)) {
    throw new Error('volume and openInterest must be integers.');
  }
  if (quote.ask < quote.bid) throw new Error('ask cannot be below bid.');

  const midpoint = (quote.bid + quote.ask) / 2;
  const absoluteSpread = quote.ask - quote.bid;
  const relativeSpreadPercent = midpoint === 0 ? Number.POSITIVE_INFINITY : (absoluteSpread / midpoint) * 100;

  return { ...quote, midpoint, absoluteSpread, relativeSpreadPercent };
}

export function filterLiquidOptions(quotes: OptionLiquidityQuote[], config: LiquidityFilterConfig): LiquidityAssessment[] {
  requireNonNegative(config.maximumRelativeSpreadPercent, 'maximumRelativeSpreadPercent');
  requireNonNegative(config.minimumVolume, 'minimumVolume');
  requireNonNegative(config.minimumOpenInterest, 'minimumOpenInterest');
  if (!Number.isInteger(config.minimumVolume) || !Number.isInteger(config.minimumOpenInterest)) {
    throw new Error('minimumVolume and minimumOpenInterest must be integers.');
  }

  return quotes
    .map(assessLiquidity)
    .filter(quote =>
      quote.relativeSpreadPercent <= config.maximumRelativeSpreadPercent &&
      quote.volume >= config.minimumVolume &&
      quote.openInterest >= config.minimumOpenInterest
    )
    .sort((left, right) =>
      left.relativeSpreadPercent - right.relativeSpreadPercent ||
      right.openInterest - left.openInterest ||
      right.volume - left.volume ||
      left.symbol.localeCompare(right.symbol)
    );
}
