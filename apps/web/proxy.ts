import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has('access_token') || request.cookies.has('refresh_token');
  if (hasSession) return NextResponse.next();

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/users/:path*',
    '/tasks/:path*',
    '/performance/:path*',
    '/insights/:path*',
    '/screenshots/:path*',
    '/settings/:path*',
  ],
};
