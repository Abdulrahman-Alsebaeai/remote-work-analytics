import { NextResponse } from 'next/server';
import { authenticatedFetch } from '../../../lib/api-proxy';
const relay = async (response: Response) => new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } });
export async function GET() { return relay(await authenticatedFetch('/tasks')); }
export async function POST(request: Request) { return relay(await authenticatedFetch('/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(await request.json()) })); }
