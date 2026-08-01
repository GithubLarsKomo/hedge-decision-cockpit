import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { isValidBearerToken } from '@/lib/auth';
import { createRequestId } from '@/lib/request-id';
import { importPortfolioSnapshot, PortfolioSnapshotConflictError } from '@/lib/imported-portfolio-snapshot';

export async function POST(req: NextRequest) {
  const requestId = createRequestId();
  if (!isValidBearerToken(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized', requestId }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: 'Invalid JSON', requestId }, { status: 422 });
  }

  try {
    const result = await importPortfolioSnapshot(body);
    return NextResponse.json({ ok: true, ...result, requestId }, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof PortfolioSnapshotConflictError) {
      return NextResponse.json({ error: error.message, requestId }, { status: 409 });
    }
    if (error instanceof ZodError || (error instanceof Error && error.message.startsWith('input_fingerprint mismatch:'))) {
      return NextResponse.json({ error: 'Invalid portfolio snapshot', requestId }, { status: 422 });
    }
    console.error('portfolio snapshot import failed', { requestId, error });
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
