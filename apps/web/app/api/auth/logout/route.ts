import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { apiUrl } from '../../../../lib/api-proxy';
export async function POST() {
  const jar = await cookies(); const refreshToken = jar.get('refresh_token')?.value;
  if (refreshToken) await fetch(`${apiUrl}/auth/logout`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken }) });
  const response = NextResponse.json({ ok: true }); response.cookies.delete('access_token'); response.cookies.delete('refresh_token'); return response;
}
