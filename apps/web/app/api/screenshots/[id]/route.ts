import { NextResponse } from 'next/server';
import { authenticatedFetch } from '../../../../lib/api-proxy';

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const response = await authenticatedFetch(`/screenshots/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } });
}
