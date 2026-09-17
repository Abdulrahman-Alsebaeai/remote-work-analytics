import { NextResponse } from 'next/server';
import { authenticatedFetch } from '../../../../lib/api-proxy';

export async function GET(request: Request) {
  const query = new URL(request.url).search;
  const response = await authenticatedFetch(`/analytics/dashboard${query}`);
  return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } });
}
