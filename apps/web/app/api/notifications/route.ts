import { NextResponse } from 'next/server';
import { authenticatedFetch } from '../../../lib/api-proxy';

export async function GET() {
  const response = await authenticatedFetch('/notifications');
  return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } });
}
