import { NextRequest, NextResponse } from 'next/server';
import { isValidBearerToken } from '@/lib/auth';
import { createRequestId } from '@/lib/request-id';
import { runStoredHistoryHedgeDecision } from '@/lib/stored-history-hedge-decision';

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  if (!isValidBearerToken(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized', requestId }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid payload', requestId }, { status: 400 });
  }

  try {
    const candidate = body as Record<string, unknown>;
    const result = await runStoredHistoryHedgeDecision({
      source: typeof candidate.source === 'string' ? candidate.source : '',
      ...(typeof candidate.asOf === 'string' ? { asOf: candidate.asOf } : {}),
      hedgeCoveragePercent: candidate.hedgeCoveragePercent == null
        ? null
        : Number(candidate.hedgeCoveragePercent)
    });

    return NextResponse.json({
      ok: true,
      id: result.id,
      created: result.created,
      action: result.input.action,
      severity: result.input.severity,
      ruleVersion: result.input.ruleVersion,
      inputFingerprint: result.input.inputFingerprint,
      requestId
    }, { status: result.created ? 201 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to derive hedge decision from market history.';
    return NextResponse.json({ error: message, requestId }, { status: 400 });
  }
}
