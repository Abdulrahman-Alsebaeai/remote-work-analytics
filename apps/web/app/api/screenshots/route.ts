import { NextResponse } from 'next/server';
import { authenticatedFetch } from '../../../lib/api-proxy';

export async function GET(request: Request) {
  const response = await authenticatedFetch(`/screenshots${new URL(request.url).search}`);
  return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } });
}
