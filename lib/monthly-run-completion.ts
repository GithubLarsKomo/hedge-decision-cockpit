import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from './prisma';

const fingerprintPattern = /^sha256:[a-f0-9]{64}$/;
const completionSchema = z.object({
  snapshot_fingerprint: z.string().regex(fingerprintPattern),
  decision_id: z.number().int().positive(),
  mapping_review_fingerprint: z.string().regex(fingerprintPattern).optional(),
  actor: z.string().trim().min(1),
  rationale: z.string().trim().min(1),
  completed_at: z.string().datetime({ offset: true })
}).strict();

export type MonthlyRunCompletionInput = z.infer<typeof completionSchema>;

export function computeMonthlyRunCompletionFingerprint(value: MonthlyRunCompletionInput): string {
  const parsed = completionSchema.parse(value);
  const canonical = JSON.stringify({
    actor: parsed.actor,
    completed_at: parsed.completed_at,
    decision_id: parsed.decision_id,
    mapping_review_fingerprint: parsed.mapping_review_fingerprint ?? null,
    rationale: parsed.rationale,
    snapshot_fingerprint: parsed.snapshot_fingerprint
  });
  return `sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}

export async function persistMonthlyRunCompletion(value: MonthlyRunCompletionInput) {
  const parsed = completionSchema.parse(value);
  const completionFingerprint = computeMonthlyRunCompletionFingerprint(parsed);
  const existing = await prisma.monthlyRunCompletion.findUnique({ where: { completionFingerprint } });
  if (existing) return { entry: existing, created: false };

  const created = await prisma.monthlyRunCompletion.create({
    data: {
      completedAt: new Date(parsed.completed_at),
      completionFingerprint,
      snapshotFingerprint: parsed.snapshot_fingerprint,
      decisionId: parsed.decision_id,
      mappingReviewFingerprint: parsed.mapping_review_fingerprint,
      actor: parsed.actor,
      rationale: parsed.rationale
    }
  });
  return { entry: created, created: true };
}

export async function getLatestMonthlyRunCompletion() {
  return prisma.monthlyRunCompletion.findFirst({ orderBy: [{ completedAt: 'desc' }, { id: 'desc' }] });
}
