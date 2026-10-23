import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatDbRequest } from '../route';

// GET /api/requests/[id] - Fetch specific request by ID from Neon PostgreSQL
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    const row = await db.reliefRequest.findUnique({
      where: { id: id.toUpperCase() },
    });

    if (!row) {
      return NextResponse.json({ error: `Request "${id}" not found in database` }, { status: 404 });
    }

    return NextResponse.json(formatDbRequest(row));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database query error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
