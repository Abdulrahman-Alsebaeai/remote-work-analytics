import { NextResponse } from 'next/server';
import { authenticatedFetch } from '../../../../lib/api-proxy';

export async function GET(request: Request) {
  const response = await authenticatedFetch(`/reports/export${new URL(request.url).search}`);
  return new NextResponse(response.body, { status: response.status, headers: { 'content-type': response.headers.get('content-type') ?? 'application/octet-stream', 'content-disposition': response.headers.get('content-disposition') ?? 'attachment', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
}
