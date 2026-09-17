import { NextResponse } from 'next/server';
import { authenticatedFetch } from '../../../../lib/api-proxy';

export async function DELETE(request: Request) {
  const response = await authenticatedFetch('/screenshots/bulk', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: await request.text(),
  });
  return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } });
}
