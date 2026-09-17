import { NextResponse } from 'next/server';
import { authenticatedFetch } from '../../../../../lib/api-proxy';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const response = await authenticatedFetch(`/tasks/${encodeURIComponent(id)}/notes`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(await request.json()) });
  return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } });
}
