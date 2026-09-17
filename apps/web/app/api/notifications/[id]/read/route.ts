import { NextResponse } from 'next/server';
import { authenticatedFetch } from '../../../../../lib/api-proxy';

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const response = await authenticatedFetch(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
  return new NextResponse(response.status === 204 ? null : await response.text(), { status: response.status });
}
