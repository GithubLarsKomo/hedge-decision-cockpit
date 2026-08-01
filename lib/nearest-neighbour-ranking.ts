export type NearestNeighbourCandidate = {
  instrumentId: string;
  privatelyTradable: boolean;
  exposureSimilarity: number;
  trackingDifference: number;
  ter: number;
  fundSize: number;
  currentActive?: boolean;
};

export type NearestNeighbourScoringPolicy = {
  version: string;
  minimumExposureSimilarity: number;
  maximumTrackingDifference: number;
  maximumTer: number;
  fundSizeReference: number;
  switchMargin: number;
  weights: {
    exposure: number;
    tracking: number;
    fundSize: number;
    ter: number;
  };
};

export type CandidateScore = {
  instrumentId: string;
  score: number;
  components: {
    exposure: number;
    tracking: number;
    fundSize: number;
    ter: number;
  };
  currentActive: boolean;
};

export type CandidateRejection = {
  instrumentId: string;
  reasons: Array<'not_privately_tradable' | 'exposure_similarity_below_minimum'>;
};

export type NearestNeighbourRankingResult = {
  policyVersion: string;
  rankedCandidates: CandidateScore[];
  rejectedCandidates: CandidateRejection[];
  preferredInstrument?: string;
  currentActiveInstrument?: string;
  selectedInstrument?: string;
  switchRecommended: boolean;
};

const ROUNDING_FACTOR = 1_000_000_000_000;

function round(value: number): number {
  return Math.round(value * ROUNDING_FACTOR) / ROUNDING_FACTOR;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite.`);
}

function validatePolicy(policy: NearestNeighbourScoringPolicy): void {
  if (!policy.version.trim()) throw new Error('policy version must not be empty.');
  assertFinite('minimumExposureSimilarity', policy.minimumExposureSimilarity);
  assertFinite('maximumTrackingDifference', policy.maximumTrackingDifference);
  assertFinite('maximumTer', policy.maximumTer);
  assertFinite('fundSizeReference', policy.fundSizeReference);
  assertFinite('switchMargin', policy.switchMargin);

  if (policy.minimumExposureSimilarity < 0 || policy.minimumExposureSimilarity > 1) {
    throw new Error('minimumExposureSimilarity must be between zero and one.');
  }
  if (policy.maximumTrackingDifference <= 0) throw new Error('maximumTrackingDifference must be positive.');
  if (policy.maximumTer <= 0) throw new Error('maximumTer must be positive.');
  if (policy.fundSizeReference <= 0) throw new Error('fundSizeReference must be positive.');
  if (policy.switchMargin < 0 || policy.switchMargin > 1) throw new Error('switchMargin must be between zero and one.');

  const entries = Object.entries(policy.weights) as Array<[keyof NearestNeighbourScoringPolicy['weights'], number]>;
  for (const [name, value] of entries) {
    assertFinite(`weight ${name}`, value);
    if (value < 0) throw new Error(`weight ${name} must be non-negative.`);
  }

  const totalWeight = entries.reduce((sum, [, value]) => sum + value, 0);
  if (Math.abs(totalWeight - 1) > 1e-12) throw new Error('scoring weights must sum to one.');

  const { exposure, tracking, fundSize, ter } = policy.weights;
  if (!(exposure > tracking && exposure > fundSize && exposure > ter)) {
    throw new Error('exposure weight must be the largest scoring weight.');
  }
}

function validateCandidate(candidate: NearestNeighbourCandidate): void {
  if (!candidate.instrumentId.trim()) throw new Error('instrumentId must not be empty.');
  assertFinite(`exposureSimilarity for ${candidate.instrumentId}`, candidate.exposureSimilarity);
  assertFinite(`trackingDifference for ${candidate.instrumentId}`, candidate.trackingDifference);
  assertFinite(`ter for ${candidate.instrumentId}`, candidate.ter);
  assertFinite(`fundSize for ${candidate.instrumentId}`, candidate.fundSize);

  if (candidate.exposureSimilarity < 0 || candidate.exposureSimilarity > 1) {
    throw new Error(`invalid exposure similarity for ${candidate.instrumentId}.`);
  }
  if (candidate.ter < 0) throw new Error(`invalid TER for ${candidate.instrumentId}.`);
  if (candidate.fundSize < 0) throw new Error(`invalid fund size for ${candidate.instrumentId}.`);
}

function scoreCandidate(
  candidate: NearestNeighbourCandidate,
  policy: NearestNeighbourScoringPolicy
): CandidateScore {
  const components = {
    exposure: round(candidate.exposureSimilarity),
    tracking: round(1 - clamp(Math.abs(candidate.trackingDifference) / policy.maximumTrackingDifference, 0, 1)),
    fundSize: round(clamp(candidate.fundSize / policy.fundSizeReference, 0, 1)),
    ter: round(1 - clamp(candidate.ter / policy.maximumTer, 0, 1))
  };

  const score = round(
    components.exposure * policy.weights.exposure +
      components.tracking * policy.weights.tracking +
      components.fundSize * policy.weights.fundSize +
      components.ter * policy.weights.ter
  );

  return {
    instrumentId: candidate.instrumentId,
    score,
    components,
    currentActive: candidate.currentActive === true
  };
}

export function rankNearestNeighbourCandidates(
  candidates: NearestNeighbourCandidate[],
  policy: NearestNeighbourScoringPolicy
): NearestNeighbourRankingResult {
  validatePolicy(policy);

  const ids = new Set<string>();
  const activeCandidates: NearestNeighbourCandidate[] = [];
  for (const candidate of candidates) {
    validateCandidate(candidate);
    if (ids.has(candidate.instrumentId)) throw new Error(`duplicate candidate instrument: ${candidate.instrumentId}.`);
    ids.add(candidate.instrumentId);
    if (candidate.currentActive) activeCandidates.push(candidate);
  }
  if (activeCandidates.length > 1) throw new Error('multiple current active instruments are not allowed.');

  const rejectedCandidates: CandidateRejection[] = [];
  const eligibleCandidates: NearestNeighbourCandidate[] = [];

  for (const candidate of candidates) {
    const reasons: CandidateRejection['reasons'] = [];
    if (!candidate.privatelyTradable) reasons.push('not_privately_tradable');
    if (candidate.exposureSimilarity < policy.minimumExposureSimilarity) {
      reasons.push('exposure_similarity_below_minimum');
    }

    if (reasons.length > 0) rejectedCandidates.push({ instrumentId: candidate.instrumentId, reasons });
    else eligibleCandidates.push(candidate);
  }

  const rankedCandidates = eligibleCandidates
    .map((candidate) => scoreCandidate(candidate, policy))
    .sort((left, right) => right.score - left.score || left.instrumentId.localeCompare(right.instrumentId));
  rejectedCandidates.sort((left, right) => left.instrumentId.localeCompare(right.instrumentId));

  const preferred = rankedCandidates[0];
  const activeInput = activeCandidates[0];
  const activeScore = activeInput
    ? rankedCandidates.find((candidate) => candidate.instrumentId === activeInput.instrumentId)
    : undefined;

  let selectedInstrument = preferred?.instrumentId;
  let switchRecommended = false;

  if (activeInput) {
    if (!activeScore) {
      switchRecommended = preferred !== undefined;
    } else if (!preferred || preferred.instrumentId === activeScore.instrumentId) {
      selectedInstrument = activeScore.instrumentId;
    } else {
      const advantage = round(preferred.score - activeScore.score);
      if (advantage >= policy.switchMargin) {
        switchRecommended = true;
      } else {
        selectedInstrument = activeScore.instrumentId;
      }
    }
  }

  return {
    policyVersion: policy.version,
    rankedCandidates,
    rejectedCandidates,
    preferredInstrument: preferred?.instrumentId,
    currentActiveInstrument: activeInput?.instrumentId,
    selectedInstrument,
    switchRecommended
  };
}
