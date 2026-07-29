export type PutStrikeCandidate = {
  strike: number;
};

export type StrikeSelectionConfig = {
  targetMoneynessPercent: number;
  minimumMoneynessPercent: number;
  maximumMoneynessPercent: number;
};

export type SelectedStrike = {
  strike: number;
  moneynessPercent: number;
  distanceFromTarget: number;
};

function requirePositiveFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive finite number.`);
  }
}

function requireMoneyness(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0 || value > 100) {
    throw new Error(`${field} must be greater than zero and at most 100.`);
  }
}

export function selectPutStrike(
  underlyingPrice: number,
  candidates: PutStrikeCandidate[],
  config: StrikeSelectionConfig
): SelectedStrike {
  requirePositiveFinite(underlyingPrice, 'underlyingPrice');
  requireMoneyness(config.targetMoneynessPercent, 'targetMoneynessPercent');
  requireMoneyness(config.minimumMoneynessPercent, 'minimumMoneynessPercent');
  requireMoneyness(config.maximumMoneynessPercent, 'maximumMoneynessPercent');

  if (config.minimumMoneynessPercent > config.maximumMoneynessPercent) {
    throw new Error('minimumMoneynessPercent cannot exceed maximumMoneynessPercent.');
  }

  const eligible = candidates
    .map(candidate => {
      requirePositiveFinite(candidate.strike, 'strike');
      const moneynessPercent = (candidate.strike / underlyingPrice) * 100;
      return {
        strike: candidate.strike,
        moneynessPercent,
        distanceFromTarget: Math.abs(moneynessPercent - config.targetMoneynessPercent)
      };
    })
    .filter(candidate =>
      candidate.moneynessPercent >= config.minimumMoneynessPercent &&
      candidate.moneynessPercent <= config.maximumMoneynessPercent
    );

  if (eligible.length === 0) {
    throw new Error('No eligible put strike candidate is available.');
  }

  return eligible.sort((left, right) =>
    left.distanceFromTarget - right.distanceFromTarget ||
    left.strike - right.strike
  )[0];
}
