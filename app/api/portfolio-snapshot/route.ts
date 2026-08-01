import { NextRequest, NextResponse } from 'next/server';
import { isValidBearerToken } from '@/lib/auth';
import { createRequestId } from '@/lib/request-id';
import {
  importPortfolioSnapshot,
  PortfolioSnapshotConflictError
} from '@/lib/imported-portfolio-snapshot';

export async function POST(req: NextRequest) {
  const requestId = createRequestId();

  if (!isValidBearerToken(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized', requestId }, { status: 401 });
  }

  const body = await req.json().catch(() => null);

  try {
    const result = await importPortfolioSnapshot(body);
    return NextResponse.json({ ok: true, ...result, requestId }, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof PortfolioSnapshotConflictError) {
      return NextResponse.json({ error: error.message, requestId }, { status: 409 });
    }
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid portfolio snapshot', requestId }, { status: 400 });
    }

    console.error('portfolio snapshot ingest failed', { requestId, error });
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
