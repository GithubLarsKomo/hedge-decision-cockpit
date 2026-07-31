import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidBearerToken } from '@/lib/auth';
import { createRequestId } from '@/lib/request-id';
import { executionAuditInputSchema } from '@/lib/execution-audit-schema';
import { createPrismaExecutionAuditStore, type ExecutionAuditPrismaClient } from '@/lib/prisma-execution-audit-store';
import {
  DecisionNotFoundError,
  ExecutionAuditAlreadyExistsError,
  saveExecutionAuditRecord
} from '@/lib/execution-audit-service';

type RouteContext = { params: Promise<{ decisionId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const requestId = createRequestId();

  if (!isValidBearerToken(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized', requestId }, { status: 401 });
  }

  const { decisionId: rawDecisionId } = await context.params;
  const decisionId = Number(rawDecisionId);
  if (!Number.isInteger(decisionId) || decisionId <= 0) {
    return NextResponse.json({ error: 'Invalid decision id', requestId }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = executionAuditInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.flatten(), requestId },
      { status: 400 }
    );
  }

  try {
    const store = createPrismaExecutionAuditStore(prisma as unknown as ExecutionAuditPrismaClient);
    const result = await saveExecutionAuditRecord(store, { decisionId, audit: parsed.data });
    return NextResponse.json(
      { ok: true, decisionId, recommendationId: result.persisted.recommendationId, requestId },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof DecisionNotFoundError) {
      return NextResponse.json({ error: error.message, requestId }, { status: 404 });
    }
    if (error instanceof ExecutionAuditAlreadyExistsError) {
      return NextResponse.json({ error: error.message, requestId }, { status: 409 });
    }
    if (error instanceof Error && /must|required|cannot|precede|deviation/.test(error.message)) {
      return NextResponse.json({ error: error.message, requestId }, { status: 400 });
    }

    console.error('execution audit ingest failed', { requestId, decisionId, error });
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
