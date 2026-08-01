export type InstrumentHolding = {
  instrumentId: string;
  marketValue: number;
};

export type ExposureDefinition = {
  exposureId: string;
};

export type ExposureMapping = {
  instrumentId: string;
  exposureId: string;
  mappingVersion: string;
  purchaseEligible: boolean;
};

export type ExposureInstrumentContribution = {
  instrumentId: string;
  marketValue: number;
  purchaseEligible: boolean;
};

export type AggregatedExposure = {
  exposureId: string;
  mappingVersion: string;
  currentAmount: number;
  currentWeight: number;
  mappedInstruments: string[];
  activePurchaseInstrument?: string;
  instruments: ExposureInstrumentContribution[];
};

export type ExposureAggregationResult = {
  mappingVersion: string;
  portfolioMarketValue: number;
  exposures: AggregatedExposure[];
};

const normalize = (value: number): number => Math.round(value * 1e12) / 1e12;

export function aggregateHoldingsByExposure(input: {
  holdings: InstrumentHolding[];
  exposures: ExposureDefinition[];
  mappings: ExposureMapping[];
  mappingVersion: string;
  portfolioMarketValue?: number;
}): ExposureAggregationResult {
  const { holdings, exposures, mappings, mappingVersion } = input;

  if (!mappingVersion) throw new Error('mappingVersion is required');

  const exposureIds = new Set<string>();
  for (const exposure of exposures) {
    if (!exposure.exposureId) throw new Error('exposureId is required');
    if (exposureIds.has(exposure.exposureId)) throw new Error(`duplicate exposure id: ${exposure.exposureId}`);
    exposureIds.add(exposure.exposureId);
  }

  const mappingByInstrument = new Map<string, ExposureMapping>();
  const activeByExposure = new Map<string, string>();
  for (const mapping of mappings) {
    if (!mapping.instrumentId) throw new Error('mapping instrumentId is required');
    if (!exposureIds.has(mapping.exposureId)) throw new Error(`unknown exposure id: ${mapping.exposureId}`);
    if (mapping.mappingVersion !== mappingVersion) {
      throw new Error(`mapping version mismatch for ${mapping.instrumentId}`);
    }
    if (mappingByInstrument.has(mapping.instrumentId)) {
      throw new Error(`duplicate instrument mapping: ${mapping.instrumentId}`);
    }
    mappingByInstrument.set(mapping.instrumentId, mapping);
    if (mapping.purchaseEligible) {
      const existing = activeByExposure.get(mapping.exposureId);
      if (existing) throw new Error(`multiple active purchase instruments for exposure: ${mapping.exposureId}`);
      activeByExposure.set(mapping.exposureId, mapping.instrumentId);
    }
  }

  const holdingIds = new Set<string>();
  let holdingsTotal = 0;
  for (const holding of holdings) {
    if (!holding.instrumentId) throw new Error('holding instrumentId is required');
    if (!Number.isFinite(holding.marketValue) || holding.marketValue < 0) {
      throw new Error(`invalid market value for ${holding.instrumentId}`);
    }
    if (holdingIds.has(holding.instrumentId)) throw new Error(`duplicate holding: ${holding.instrumentId}`);
    holdingIds.add(holding.instrumentId);
    holdingsTotal += holding.marketValue;
    if (!mappingByInstrument.has(holding.instrumentId)) {
      throw new Error(`unmapped holding: ${holding.instrumentId}`);
    }
  }

  const portfolioMarketValue = input.portfolioMarketValue ?? holdingsTotal;
  if (!Number.isFinite(portfolioMarketValue) || portfolioMarketValue < 0) {
    throw new Error('portfolioMarketValue must be non-negative');
  }
  if (portfolioMarketValue + 1e-9 < holdingsTotal) {
    throw new Error('portfolioMarketValue cannot be below mapped holdings total');
  }

  const holdingsById = new Map(holdings.map((holding) => [holding.instrumentId, holding]));

  const aggregated = exposures.map((exposure): AggregatedExposure => {
    const exposureMappings = mappings
      .filter((mapping) => mapping.exposureId === exposure.exposureId)
      .sort((a, b) => a.instrumentId.localeCompare(b.instrumentId));

    const instruments: ExposureInstrumentContribution[] = exposureMappings
      .filter((mapping) => holdingsById.has(mapping.instrumentId))
      .map((mapping) => ({
        instrumentId: mapping.instrumentId,
        marketValue: holdingsById.get(mapping.instrumentId)!.marketValue,
        purchaseEligible: mapping.purchaseEligible
      }));

    const currentAmount = instruments.reduce((sum, instrument) => sum + instrument.marketValue, 0);
    const activePurchaseInstrument = activeByExposure.get(exposure.exposureId);

    return {
      exposureId: exposure.exposureId,
      mappingVersion,
      currentAmount,
      currentWeight: portfolioMarketValue === 0 ? 0 : normalize(currentAmount / portfolioMarketValue),
      mappedInstruments: exposureMappings.map((mapping) => mapping.instrumentId),
      ...(activePurchaseInstrument ? { activePurchaseInstrument } : {}),
      instruments
    };
  });

  return {
    mappingVersion,
    portfolioMarketValue,
    exposures: aggregated
  };
}
