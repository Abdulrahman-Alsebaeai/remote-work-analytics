import { NextResponse } from 'next/server';
import { authenticatedFetch } from '../../../../../lib/api-proxy';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const response = await authenticatedFetch(`/screenshots/${encodeURIComponent(id)}/thumbnail`);
  return new NextResponse(response.body, { status: response.status, headers: { 'content-type': response.headers.get('content-type') ?? 'application/octet-stream', 'cache-control': 'private, max-age=300', 'x-content-type-options': 'nosniff' } });
}
