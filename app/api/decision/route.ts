import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { isValidBearerToken } from '@/lib/auth';
import { createRequestId } from '@/lib/request-id';
import { DecisionConflictError, persistDecision } from '@/lib/decision-persistence';

export async function POST(req: NextRequest) {
  const requestId = createRequestId();

  if (!isValidBearerToken(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized', requestId }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: 'Invalid payload', requestId }, { status: 400 });
  }

  try {
    const result = await persistDecision(body);
    return NextResponse.json({ ok: true, id: result.id, requestId }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid payload', details: error.flatten(), requestId },
        { status: 400 }
      );
    }
    if (error instanceof DecisionConflictError) {
      return NextResponse.json({ error: error.message, requestId }, { status: 409 });
    }

    console.error('decision ingest failed', { requestId, error });
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
