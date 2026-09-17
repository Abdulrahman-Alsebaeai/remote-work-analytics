import { NextResponse } from 'next/server';
import { authenticatedFetch } from '../../../../lib/api-proxy';

export async function GET() {
  const response = await authenticatedFetch('/auth/me');
  if (!response.ok) return NextResponse.json({ authenticated: false }, { status: 401 });
  const profile = await response.json();
  if (!['ADMIN', 'MANAGER'].includes(profile.role)) return NextResponse.json({ authenticated: false }, { status: 403 });
  return NextResponse.json({ authenticated: true, profile });
}
