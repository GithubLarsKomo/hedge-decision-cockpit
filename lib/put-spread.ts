export type PutQuote = {
  strike: number;
  premium: number;
};

export type PutSpreadConfig = {
  targetWidthPercent: number;
  minimumWidthPercent: number;
  maximumWidthPercent: number;
  contractMultiplier?: number;
  fxEurPerQuoteCurrency?: number;
};

export type PutSpread = {
  longStrike: number;
  shortStrike: number;
  width: number;
  widthPercent: number;
  netDebitPerUnit: number;
  netDebitPerContractEur: number;
  maximumPayoffPerContractEur: number;
  maximumProfitPerContractEur: number;
  breakEven: number;
  distanceFromTargetWidthPercent: number;
};

function requirePositive(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${field} must be a positive finite number.`);
}

function validateQuote(quote: PutQuote, field: string): void {
  requirePositive(quote.strike, `${field}.strike`);
  if (!Number.isFinite(quote.premium) || quote.premium < 0) {
    throw new Error(`${field}.premium must be a non-negative finite number.`);
  }
}

export function constructPutSpread(
  longPut: PutQuote,
  shortPutCandidates: PutQuote[],
  config: PutSpreadConfig
): PutSpread {
  validateQuote(longPut, 'longPut');
  requirePositive(config.targetWidthPercent, 'targetWidthPercent');
  requirePositive(config.minimumWidthPercent, 'minimumWidthPercent');
  requirePositive(config.maximumWidthPercent, 'maximumWidthPercent');
  if (config.minimumWidthPercent > config.maximumWidthPercent) {
    throw new Error('minimumWidthPercent cannot exceed maximumWidthPercent.');
  }

  const multiplier = config.contractMultiplier ?? 100;
  const fx = config.fxEurPerQuoteCurrency ?? 1;
  requirePositive(multiplier, 'contractMultiplier');
  requirePositive(fx, 'fxEurPerQuoteCurrency');

  const eligible = shortPutCandidates.map((candidate, index) => {
    validateQuote(candidate, `shortPutCandidates[${index}]`);
    if (candidate.strike >= longPut.strike) return null;

    const width = longPut.strike - candidate.strike;
    const widthPercent = width / longPut.strike * 100;
    const netDebitPerUnit = longPut.premium - candidate.premium;
    if (
      netDebitPerUnit < 0 ||
      netDebitPerUnit > width ||
      widthPercent < config.minimumWidthPercent ||
      widthPercent > config.maximumWidthPercent
    ) {
      return null;
    }

    const netDebitPerContractEur = netDebitPerUnit * multiplier * fx;
    const maximumPayoffPerContractEur = width * multiplier * fx;
    return {
      longStrike: longPut.strike,
      shortStrike: candidate.strike,
      width,
      widthPercent,
      netDebitPerUnit,
      netDebitPerContractEur,
      maximumPayoffPerContractEur,
      maximumProfitPerContractEur: maximumPayoffPerContractEur - netDebitPerContractEur,
      breakEven: longPut.strike - netDebitPerUnit,
      distanceFromTargetWidthPercent: Math.abs(widthPercent - config.targetWidthPercent)
    };
  }).filter((candidate): candidate is PutSpread => candidate !== null);

  if (eligible.length === 0) throw new Error('No eligible short put candidate is available.');

  return eligible.sort((left, right) =>
    left.distanceFromTargetWidthPercent - right.distanceFromTargetWidthPercent ||
    right.shortStrike - left.shortStrike ||
    left.netDebitPerUnit - right.netDebitPerUnit
  )[0];
}
