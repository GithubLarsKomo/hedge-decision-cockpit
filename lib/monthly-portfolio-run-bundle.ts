import { createHash } from 'node:crypto';
import { z } from 'zod';
import { computeEtfMappingFingerprint, validateEtfNearestNeighbourMapping } from './etf-nearest-neighbour-mapping';
import { computeGpoSourceEvidenceFingerprint, validateGpoSourceEvidence } from './gpo-source-evidence';
import { computeGpoTargetAllocationFingerprint, validateGpoTargetAllocation } from './gpo-target-allocation';
import type { MonthlyPortfolioWorkflowPreprocessing } from './monthly-portfolio-workflow';
import type { HedgeContext } from './portfolio-decision-variants';
import { generatePortfolioSnapshot, monthlyPortfolioInputSchema, type MonthlyPortfolioInput } from './portfolio-snapshot-generator';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const sha256Pattern = /^sha256:[a-f0-9]{64}$/;
const bareSha256Pattern = /^[a-f0-9]{64}$/;

const hedgeContextSchema = z.object({
  risk_regime: z.string().min(1),
  recommended_hedge_ratio: z.number().finite().min(0).max(1),
  hedge_notional_eur: z.number().finite().nonnegative(),
  confidence: z.string().min(1),
  reasons: z.array(z.string())
}).passthrough();

const reviewPolicySchema = z.object({
  review_interval_days: z.number().int().positive(),
  overdue_grace_days: z.number().int().nonnegative()
}).strict();

const bundleSchema = z.object({
  schema_version: z.literal('monthly-portfolio-run-bundle/1.0'),
  as_of: z.string().regex(datePattern),
  members: z.object({
    monthly_portfolio_input: z.object({
      value: monthlyPortfolioInputSchema,
      fingerprint: z.string().regex(sha256Pattern)
    }).strict(),
    gpo_target_allocation: z.object({
      value: z.unknown(),
      fingerprint: z.string().regex(bareSha256Pattern)
    }).strict(),
    gpo_source_evidence: z.object({
      value: z.unknown(),
      fingerprint: z.string().regex(bareSha256Pattern)
    }).strict(),
    etf_mapping: z.object({
      value: z.unknown(),
      fingerprint: z.string().regex(sha256Pattern)
    }).strict()
  }).strict(),
  etf_mapping_review_policy: reviewPolicySchema,
  hedge_context: hedgeContextSchema.optional()
}).strict();

export type MonthlyPortfolioRunBundle = z.infer<typeof bundleSchema>;

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function stableValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)])
    );
  }
  return value;
}

export function validateMonthlyPortfolioRunBundle(value: unknown): MonthlyPortfolioRunBundle {
  const bundle = bundleSchema.parse(value);

  const monthlyFingerprint = generatePortfolioSnapshot(bundle.members.monthly_portfolio_input.value).input_fingerprint;
  if (bundle.members.monthly_portfolio_input.fingerprint !== monthlyFingerprint) {
    throw new Error('monthly portfolio input fingerprint mismatch.');
  }

  const target = validateGpoTargetAllocation(bundle.members.gpo_target_allocation.value);
  const targetFingerprint = computeGpoTargetAllocationFingerprint(target);
  if (bundle.members.gpo_target_allocation.fingerprint !== targetFingerprint) {
    throw new Error('GPO target allocation fingerprint mismatch.');
  }

  const evidence = validateGpoSourceEvidence(bundle.members.gpo_source_evidence.value);
  const evidenceFingerprint = computeGpoSourceEvidenceFingerprint(evidence);
  if (bundle.members.gpo_source_evidence.fingerprint !== evidenceFingerprint) {
    throw new Error('GPO source evidence fingerprint mismatch.');
  }
  if (evidence.supported_allocation_fingerprint !== targetFingerprint) {
    throw new Error('GPO source evidence does not match target allocation fingerprint.');
  }

  const mapping = validateEtfNearestNeighbourMapping(bundle.members.etf_mapping.value);
  const mappingFingerprint = computeEtfMappingFingerprint(mapping);
  if (bundle.members.etf_mapping.fingerprint !== mappingFingerprint) {
    throw new Error('ETF mapping fingerprint mismatch.');
  }

  return bundle;
}

export function computeMonthlyPortfolioRunBundleFingerprint(value: unknown): string {
  const bundle = validateMonthlyPortfolioRunBundle(value);
  const canonical = JSON.stringify(stableValue(bundle as JsonValue));
  return `sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}

export type PreparedMonthlyPortfolioRunBundle = {
  input: MonthlyPortfolioInput;
  hedgeContext?: HedgeContext;
  preprocessing: MonthlyPortfolioWorkflowPreprocessing;
  bundleFingerprint: string;
};

export function prepareMonthlyPortfolioRunBundle(value: unknown): PreparedMonthlyPortfolioRunBundle {
  const bundle = validateMonthlyPortfolioRunBundle(value);

  return {
    input: bundle.members.monthly_portfolio_input.value,
    hedgeContext: bundle.hedge_context as HedgeContext | undefined,
    preprocessing: {
      gpoTargetAllocation: bundle.members.gpo_target_allocation.value,
      gpoSourceEvidence: bundle.members.gpo_source_evidence.value,
      etfMapping: bundle.members.etf_mapping.value,
      etfMappingReview: {
        asOf: bundle.as_of,
        policy: bundle.etf_mapping_review_policy
      }
    },
    bundleFingerprint: computeMonthlyPortfolioRunBundleFingerprint(bundle)
  };
}
