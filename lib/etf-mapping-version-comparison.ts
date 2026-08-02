import { createHash } from 'node:crypto';
import {
  computeEtfMappingFingerprint,
  validateEtfNearestNeighbourMapping,
  type EtfCandidate,
  type EtfNearestNeighbourMapping
} from './etf-nearest-neighbour-mapping';

export type EtfMappingExposureChange =
  | 'unchanged'
  | 'added'
  | 'removed'
  | 'purchase_instrument_changed'
  | 'candidate_set_changed';

export type EtfMappingExposureComparison = {
  exposure_id: string;
  change: EtfMappingExposureChange;
  previous_selected_instrument_id?: string;
  next_selected_instrument_id?: string;
  candidate_instruments_added: string[];
  candidate_instruments_removed: string[];
  candidate_instruments_changed: string[];
};

export type EtfMappingVersionComparison = {
  schema_version: 'etf-mapping-version-comparison/1.0';
  previous_mapping_version: string;
  previous_mapping_fingerprint: string;
  next_mapping_version: string;
  next_mapping_fingerprint: string;
  exposures: EtfMappingExposureComparison[];
};

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function sortJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortJson(child)])
    );
  }
  return value;
}

function canonicalCandidate(candidate: EtfCandidate): string {
  return JSON.stringify(sortJson(candidate as unknown as JsonValue));
}

function compareCandidates(previous: EtfCandidate[], next: EtfCandidate[]) {
  const previousById = new Map(previous.map((candidate) => [candidate.instrument_id, candidate]));
  const nextById = new Map(next.map((candidate) => [candidate.instrument_id, candidate]));
  const previousIds = [...previousById.keys()].sort();
  const nextIds = [...nextById.keys()].sort();

  const added = nextIds.filter((id) => !previousById.has(id));
  const removed = previousIds.filter((id) => !nextById.has(id));
  const changed = previousIds
    .filter((id) => nextById.has(id))
    .filter((id) => canonicalCandidate(previousById.get(id)!) !== canonicalCandidate(nextById.get(id)!));

  return { added, removed, changed };
}

function byExposure(mapping: EtfNearestNeighbourMapping) {
  return new Map(mapping.exposures.map((exposure) => [exposure.exposure_id, exposure]));
}

export function compareEtfMappingVersions(
  previousValue: unknown,
  nextValue: unknown
): EtfMappingVersionComparison {
  const previous = validateEtfNearestNeighbourMapping(previousValue);
  const next = validateEtfNearestNeighbourMapping(nextValue);
  const previousFingerprint = computeEtfMappingFingerprint(previous);
  const nextFingerprint = computeEtfMappingFingerprint(next);

  if (previousFingerprint === nextFingerprint && previous.mapping_version !== next.mapping_version) {
    throw new Error('Identical ETF mapping fingerprints cannot have different mapping versions.');
  }

  const previousByExposure = byExposure(previous);
  const nextByExposure = byExposure(next);
  const exposureIds = [...new Set([...previousByExposure.keys(), ...nextByExposure.keys()])].sort();

  const exposures = exposureIds.map<EtfMappingExposureComparison>((exposureId) => {
    const previousExposure = previousByExposure.get(exposureId);
    const nextExposure = nextByExposure.get(exposureId);

    if (!previousExposure) {
      return {
        exposure_id: exposureId,
        change: 'added',
        next_selected_instrument_id: nextExposure!.selected_instrument_id,
        candidate_instruments_added: nextExposure!.candidates.map((candidate) => candidate.instrument_id).sort(),
        candidate_instruments_removed: [],
        candidate_instruments_changed: []
      };
    }

    if (!nextExposure) {
      return {
        exposure_id: exposureId,
        change: 'removed',
        previous_selected_instrument_id: previousExposure.selected_instrument_id,
        candidate_instruments_added: [],
        candidate_instruments_removed: previousExposure.candidates.map((candidate) => candidate.instrument_id).sort(),
        candidate_instruments_changed: []
      };
    }

    const candidateChanges = compareCandidates(previousExposure.candidates, nextExposure.candidates);
    const purchaseChanged = previousExposure.selected_instrument_id !== nextExposure.selected_instrument_id;
    const candidatesChanged =
      candidateChanges.added.length > 0 ||
      candidateChanges.removed.length > 0 ||
      candidateChanges.changed.length > 0 ||
      previousExposure.desired_reference !== nextExposure.desired_reference;

    return {
      exposure_id: exposureId,
      change: purchaseChanged
        ? 'purchase_instrument_changed'
        : candidatesChanged
          ? 'candidate_set_changed'
          : 'unchanged',
      previous_selected_instrument_id: previousExposure.selected_instrument_id,
      next_selected_instrument_id: nextExposure.selected_instrument_id,
      candidate_instruments_added: candidateChanges.added,
      candidate_instruments_removed: candidateChanges.removed,
      candidate_instruments_changed: candidateChanges.changed
    };
  });

  return {
    schema_version: 'etf-mapping-version-comparison/1.0',
    previous_mapping_version: previous.mapping_version,
    previous_mapping_fingerprint: previousFingerprint,
    next_mapping_version: next.mapping_version,
    next_mapping_fingerprint: nextFingerprint,
    exposures
  };
}

export function canonicalizeEtfMappingVersionComparison(value: EtfMappingVersionComparison): string {
  return JSON.stringify(sortJson(value as unknown as JsonValue));
}

export function computeEtfMappingVersionComparisonFingerprint(
  value: EtfMappingVersionComparison
): string {
  return `sha256:${createHash('sha256')
    .update(canonicalizeEtfMappingVersionComparison(value), 'utf8')
    .digest('hex')}`;
}
