import { z } from 'zod';
import {
  computeEtfMappingFingerprint,
  validateEtfNearestNeighbourMapping
} from './etf-nearest-neighbour-mapping';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const policySchema = z.object({
  review_interval_days: z.number().int().positive(),
  overdue_grace_days: z.number().int().nonnegative()
}).strict();

export type EtfMappingReviewPolicy = z.infer<typeof policySchema>;
export type EtfMappingReviewStatus = {
  status: 'current' | 'due' | 'overdue';
  as_of: string;
  effective_date: string;
  next_review_date: string;
  days_until_due: number;
  mapping_version: string;
  mapping_fingerprint: string;
};

const DAY_MS = 86_400_000;

function parseDate(value: string, field: string): Date {
  if (!datePattern.test(value)) throw new Error(`${field} must use YYYY-MM-DD.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${field} must be a valid calendar date.`);
  }
  return date;
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

export function evaluateEtfMappingReviewStatus(
  mappingValue: unknown,
  asOf: string,
  policyValue: unknown
): EtfMappingReviewStatus {
  const mapping = validateEtfNearestNeighbourMapping(mappingValue);
  const policy = policySchema.parse(policyValue);
  const effective = parseDate(mapping.effective_date, 'mapping effective_date');
  const asOfDate = parseDate(asOf, 'as_of');
  if (asOfDate.getTime() < effective.getTime()) {
    throw new Error('as_of cannot precede mapping effective_date.');
  }

  const nextReview = addDays(effective, policy.review_interval_days);
  const overdueAfter = addDays(nextReview, policy.overdue_grace_days);
  const daysUntilDue = Math.round((nextReview.getTime() - asOfDate.getTime()) / DAY_MS);

  const status: EtfMappingReviewStatus['status'] =
    asOfDate.getTime() < nextReview.getTime()
      ? 'current'
      : asOfDate.getTime() <= overdueAfter.getTime()
        ? 'due'
        : 'overdue';

  return {
    status,
    as_of: asOf,
    effective_date: mapping.effective_date,
    next_review_date: formatDate(nextReview),
    days_until_due: daysUntilDue,
    mapping_version: mapping.mapping_version,
    mapping_fingerprint: computeEtfMappingFingerprint(mapping)
  };
}
