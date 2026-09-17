import { NextResponse } from 'next/server';
import { apiUrl, cookieOptions } from '../../../../lib/api-proxy';
export async function POST(request: Request) {
  const response = await fetch(`${apiUrl}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(await request.json()), cache: 'no-store' });
  if (!response.ok) return NextResponse.json({ message: 'Authentication failed' }, { status: response.status });
  const tokens = await response.json();
  const profileResponse = await fetch(`${apiUrl}/auth/me`, { headers: { authorization: `Bearer ${tokens.accessToken}` }, cache: 'no-store' });
  const profile = profileResponse.ok ? await profileResponse.json() : null;
  if (!profile || !['ADMIN', 'MANAGER'].includes(profile.role)) {
    await fetch(`${apiUrl}/auth/logout`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: tokens.refreshToken }) });
    return NextResponse.json({ message: 'Manager access required' }, { status: 403 });
  }
  const result = NextResponse.json({ ok: true });
  result.cookies.set('access_token', tokens.accessToken, cookieOptions(15 * 60)); result.cookies.set('refresh_token', tokens.refreshToken, cookieOptions(30 * 86400)); return result;
}
