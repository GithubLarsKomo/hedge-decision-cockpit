import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { MonthlyPortfolioInput } from './portfolio-snapshot-generator';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const instrumentId = z.string().min(1);

const candidateSchema = z.object({
  instrument_id: instrumentId,
  exposure_fidelity: z.number().finite().min(0).max(1),
  ter: z.number().finite().nonnegative().max(1),
  tracking_difference: z.number().finite().optional(),
  fund_size: z.number().finite().nonnegative().optional(),
  savings_plan_eligible: z.boolean(),
  tradable: z.boolean(),
  active_for_new_purchases: z.boolean()
}).strict();

const exposureMappingSchema = z.object({
  exposure_id: z.string().min(1),
  desired_reference: z.string().min(1),
  selected_instrument_id: instrumentId,
  candidates: z.array(candidateSchema).min(1)
}).strict().superRefine((value, context) => {
  const ids = new Set<string>();
  for (const [index, candidate] of value.candidates.entries()) {
    if (ids.has(candidate.instrument_id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['candidates', index, 'instrument_id'],
        message: 'candidate instrument_id must be unique within an exposure.'
      });
    }
    ids.add(candidate.instrument_id);
  }

  const selected = value.candidates.find(
    (candidate) => candidate.instrument_id === value.selected_instrument_id
  );
  if (!selected) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['selected_instrument_id'],
      message: 'selected_instrument_id must reference one of the candidates.'
    });
    return;
  }
  if (!selected.tradable) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['selected_instrument_id'],
      message: 'selected candidate must be tradable.'
    });
  }
  if (!selected.active_for_new_purchases) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['selected_instrument_id'],
      message: 'selected candidate must be active_for_new_purchases.'
    });
  }
});

const mappingSchema = z.object({
  schema_version: z.literal('etf-nearest-neighbour-mapping/1.0'),
  mapping_version: z.string().min(1),
  effective_date: z.string().regex(datePattern),
  exposures: z.array(exposureMappingSchema).min(1)
}).strict().superRefine((value, context) => {
  const ids = new Set<string>();
  for (const [index, exposure] of value.exposures.entries()) {
    if (ids.has(exposure.exposure_id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['exposures', index, 'exposure_id'],
        message: 'exposure_id must be unique.'
      });
    }
    ids.add(exposure.exposure_id);
  }
});

export type EtfCandidate = z.infer<typeof candidateSchema>;
export type EtfNearestNeighbourMapping = z.infer<typeof mappingSchema>;

export type RankedEtfCandidate = EtfCandidate & {
  score: number;
  score_breakdown: {
    exposure_fidelity: number;
    ter_penalty: number;
    tracking_difference_penalty: number;
    fund_size_bonus: number;
    savings_plan_bonus: number;
  };
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

function canonicalMapping(mapping: EtfNearestNeighbourMapping): EtfNearestNeighbourMapping {
  return {
    ...mapping,
    exposures: [...mapping.exposures]
      .sort((left, right) => left.exposure_id.localeCompare(right.exposure_id))
      .map((exposure) => ({
        ...exposure,
        candidates: [...exposure.candidates].sort((left, right) =>
          left.instrument_id.localeCompare(right.instrument_id)
        )
      }))
  };
}

export function validateEtfNearestNeighbourMapping(value: unknown): EtfNearestNeighbourMapping {
  return mappingSchema.parse(value);
}

export function computeEtfMappingFingerprint(value: unknown): string {
  const mapping = validateEtfNearestNeighbourMapping(value);
  const canonical = JSON.stringify(sortJson(canonicalMapping(mapping) as JsonValue));
  return `sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}

export function rankEtfCandidates(candidates: EtfCandidate[]): RankedEtfCandidate[] {
  const parsed = z.array(candidateSchema).min(1).parse(candidates);
  const ranked = parsed.map((candidate) => {
    // Fidelity intentionally dominates every secondary cost/convenience component.
    // A 1 percentage-point fidelity advantage contributes 10,000 score points,
    // while TER/tracking/fund-size/savings-plan adjustments are bounded far below it.
    const fidelityComponent = candidate.exposure_fidelity * 1_000_000;
    const terPenalty = Math.min(candidate.ter, 1) * 10_000;
    const trackingPenalty = Math.min(Math.abs(candidate.tracking_difference ?? 0), 1) * 5_000;
    const fundSizeBonus = Math.min(candidate.fund_size ?? 0, 10_000_000_000) / 10_000_000_000 * 100;
    const savingsPlanBonus = candidate.savings_plan_eligible ? 10 : 0;
    const eligibilityPenalty = candidate.tradable && candidate.active_for_new_purchases ? 0 : 1_000_000_000;

    return {
      ...candidate,
      score: fidelityComponent - terPenalty - trackingPenalty + fundSizeBonus + savingsPlanBonus - eligibilityPenalty,
      score_breakdown: {
        exposure_fidelity: fidelityComponent,
        ter_penalty: terPenalty,
        tracking_difference_penalty: trackingPenalty,
        fund_size_bonus: fundSizeBonus,
        savings_plan_bonus: savingsPlanBonus
      }
    };
  });

  return ranked.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.instrument_id.localeCompare(right.instrument_id);
  });
}

export function applyEtfNearestNeighbourMapping(
  input: MonthlyPortfolioInput,
  value: unknown
): MonthlyPortfolioInput {
  const mapping = validateEtfNearestNeighbourMapping(value);
  const inputIds = new Set(input.exposures.map((exposure) => exposure.exposure_id));
  const mappingIds = new Set(mapping.exposures.map((exposure) => exposure.exposure_id));

  if (inputIds.size !== mappingIds.size || [...inputIds].some((id) => !mappingIds.has(id))) {
    throw new Error('ETF mapping exposures must exactly match monthly portfolio input exposures.');
  }

  const byExposure = new Map(mapping.exposures.map((exposure) => [exposure.exposure_id, exposure]));
  const fingerprint = computeEtfMappingFingerprint(mapping);

  return {
    ...input,
    exposures: input.exposures.map((exposure) => {
      const mappingExposure = byExposure.get(exposure.exposure_id);
      if (!mappingExposure) throw new Error(`Missing ETF mapping for exposure ${exposure.exposure_id}.`);
      const mappedInstruments = exposure.mapped_instruments.includes(mappingExposure.selected_instrument_id)
        ? exposure.mapped_instruments
        : [...exposure.mapped_instruments, mappingExposure.selected_instrument_id];

      return {
        ...exposure,
        active_purchase_instrument: mappingExposure.selected_instrument_id,
        mapped_instruments: mappedInstruments,
        mapping_version: mapping.mapping_version
      };
    }),
    source_fingerprints: [...input.source_fingerprints, `etf-mapping:${fingerprint}`]
  };
}
