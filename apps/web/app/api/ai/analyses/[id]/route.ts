import { NextResponse } from 'next/server';
import { authenticatedFetch } from '../../../../../lib/api-proxy';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) { const { id } = await context.params; const response = await authenticatedFetch(`/ai/analyses/${encodeURIComponent(id)}`); return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } }); }
