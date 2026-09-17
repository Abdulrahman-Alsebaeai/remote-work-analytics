import { NextResponse } from 'next/server';
import { authenticatedFetch } from '../../../lib/api-proxy';
export async function GET() { const response = await authenticatedFetch('/users'); return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } }); }
export async function POST(request: Request) { const response = await authenticatedFetch('/users', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(await request.json()) }); return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } }); }
