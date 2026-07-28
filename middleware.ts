import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const username = process.env.DASHBOARD_BASIC_AUTH_USER;
  const password = process.env.DASHBOARD_BASIC_AUTH_PASSWORD;

  if (!username || !password) return NextResponse.next();

  const authorization = req.headers.get('authorization');
  if (authorization?.startsWith('Basic ')) {
    const decoded = atob(authorization.slice(6));
    const separator = decoded.indexOf(':');
    if (separator >= 0 && decoded.slice(0, separator) === username && decoded.slice(separator + 1) === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Hedge Decision Cockpit"' }
  });
}

export const config = {
  matcher: ['/((?!api/decision|_next/static|_next/image|favicon.ico).*)']
};
