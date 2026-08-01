import { createHash } from 'node:crypto';
import { z } from 'zod';

const fingerprintPattern = /^sha256:[a-f0-9]{64}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const weight = z.number().finite().min(0).max(1);

const strategySchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  source_observation_date: z.string().regex(datePattern),
  estimation_status: z.enum(['observed', 'estimated', 'mixed', 'manual']),
  confidence: z.enum(['high', 'medium', 'low'])
}).strict();

const portfolioSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  market_value: z.number().finite().nonnegative(),
  monthly_contribution: z.number().finite().nonnegative(),
  additional_cash_available: z.number().finite().nonnegative(),
  target_equity_weight: weight,
  current_equity_weight: weight,
  equity_gap_amount: z.number().finite()
}).strict();

const exposureSchema = z.object({
  exposure_id: z.string().min(1),
  target_weight: weight,
  current_weight: weight,
  gap_amount: z.number().finite(),
  target_source: z.enum(['observed', 'estimated', 'manual']),
  active_purchase_instrument: z.string().min(1).optional(),
  mapped_instruments: z.array(z.string().min(1)).min(1),
  mapping_version: z.string().min(1)
}).strict().superRefine((value, context) => {
  if (value.active_purchase_instrument && !value.mapped_instruments.includes(value.active_purchase_instrument)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['active_purchase_instrument'],
      message: 'active_purchase_instrument must occur in mapped_instruments.'
    });
  }
});

const purchaseScenarioSchema = z.object({
  scenario_id: z.string().min(1),
  contribution_amount: z.number().finite().nonnegative(),
  additional_purchase_amount: z.number().finite().nonnegative()
}).strict();

export const portfolioSnapshotSchema = z.object({
  schema_version: z.literal('portfolio-snapshot/1.0'),
  snapshot_id: z.string().min(1),
  revision: z.number().int().min(1),
  as_of: z.string().regex(datePattern),
  generated_at: z.string().datetime({ offset: true }),
  strategy: strategySchema,
  portfolio: portfolioSchema,
  exposures: z.array(exposureSchema).min(1),
  purchase_scenarios: z.array(purchaseScenarioSchema),
  source_fingerprints: z.array(z.string().min(1)),
  input_fingerprint: z.string().regex(fingerprintPattern)
}).strict().superRefine((value, context) => {
  const exposureIds = new Set<string>();
  for (const [index, exposure] of value.exposures.entries()) {
    if (exposureIds.has(exposure.exposure_id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['exposures', index, 'exposure_id'], message: 'exposure_id must be unique.' });
    }
    exposureIds.add(exposure.exposure_id);
  }

  const scenarioIds = new Set<string>();
  for (const [index, scenario] of value.purchase_scenarios.entries()) {
    if (scenarioIds.has(scenario.scenario_id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['purchase_scenarios', index, 'scenario_id'], message: 'scenario_id must be unique.' });
    }
    scenarioIds.add(scenario.scenario_id);
  }
});

export type PortfolioSnapshot = z.infer<typeof portfolioSnapshotSchema>;

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

export function canonicalizePortfolioSnapshot(value: unknown): string {
  const parsed = portfolioSnapshotSchema.parse(value);
  const { input_fingerprint: _fingerprint, ...payload } = parsed;
  return JSON.stringify(sortJson(payload as JsonValue));
}

export function computePortfolioSnapshotFingerprint(value: unknown): string {
  const canonical = canonicalizePortfolioSnapshot(value);
  return `sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}

export function validatePortfolioSnapshot(value: unknown): PortfolioSnapshot {
  const parsed = portfolioSnapshotSchema.parse(value);
  const computed = computePortfolioSnapshotFingerprint(parsed);
  if (parsed.input_fingerprint !== computed) {
    throw new Error(`input_fingerprint mismatch: expected ${computed}.`);
  }
  return parsed;
}
