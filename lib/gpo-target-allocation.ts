import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { MonthlyPortfolioInput } from './portfolio-snapshot-generator';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const monthPattern = /^\d{4}-\d{2}$/;
const targetWeight = z.number().finite().min(0).max(1);
const TARGET_TOTAL_TOLERANCE = 1e-9;

const exposureSchema = z.object({
  exposure_id: z.string().min(1),
  target_weight: targetWeight
}).strict();

export const gpoTargetAllocationSchema = z.object({
  schema_version: z.literal('gpo-target-allocation/1.0'),
  effective_month: z.string().regex(monthPattern),
  effective_date: z.string().regex(datePattern),
  source_observation_date: z.string().regex(datePattern),
  provenance: z.enum(['observed', 'estimated', 'manual']),
  confidence: z.enum(['high', 'medium', 'low']),
  exposures: z.array(exposureSchema).min(1)
}).strict().superRefine((value, context) => {
  const seen = new Set<string>();
  for (const [index, exposure] of value.exposures.entries()) {
    if (seen.has(exposure.exposure_id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['exposures', index, 'exposure_id'],
        message: 'exposure_id must be unique.'
      });
    }
    seen.add(exposure.exposure_id);
  }

  const total = value.exposures.reduce((sum, exposure) => sum + exposure.target_weight, 0);
  if (Math.abs(total - 1) > TARGET_TOTAL_TOLERANCE) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['exposures'],
      message: `target weights must total 1 within tolerance ${TARGET_TOTAL_TOLERANCE}.`
    });
  }
});

export type GpoTargetAllocation = z.infer<typeof gpoTargetAllocationSchema>;

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

export function validateGpoTargetAllocation(value: unknown): GpoTargetAllocation {
  return gpoTargetAllocationSchema.parse(value);
}

export function canonicalizeGpoTargetAllocation(value: unknown): string {
  const allocation = validateGpoTargetAllocation(value);
  return JSON.stringify(sortJson(allocation as JsonValue));
}

export function computeGpoTargetAllocationFingerprint(value: unknown): string {
  return createHash('sha256')
    .update(canonicalizeGpoTargetAllocation(value), 'utf8')
    .digest('hex');
}

export function applyGpoTargetAllocation(
  input: MonthlyPortfolioInput,
  allocationValue: unknown
): MonthlyPortfolioInput {
  const allocation = validateGpoTargetAllocation(allocationValue);
  const inputIds = input.exposures.map((exposure) => exposure.exposure_id).sort();
  const targetIds = allocation.exposures.map((exposure) => exposure.exposure_id).sort();

  if (inputIds.length !== targetIds.length || inputIds.some((id, index) => id !== targetIds[index])) {
    throw new Error('GPO target allocation exposures must exactly match monthly portfolio input exposures.');
  }

  const targets = new Map(
    allocation.exposures.map((exposure) => [exposure.exposure_id, exposure.target_weight] as const)
  );

  return {
    ...input,
    strategy: {
      ...input.strategy,
      version: allocation.effective_month,
      source_observation_date: allocation.source_observation_date,
      estimation_status: allocation.provenance,
      confidence: allocation.confidence
    },
    exposures: input.exposures.map((exposure) => ({
      ...exposure,
      target_weight: targets.get(exposure.exposure_id)!,
      target_source: allocation.provenance
    })),
    source_fingerprints: [
      ...input.source_fingerprints,
      `gpo-target-allocation:${computeGpoTargetAllocationFingerprint(allocation)}`
    ]
  };
}
