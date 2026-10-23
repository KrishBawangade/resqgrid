import { NextResponse } from 'next/server';


const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

// In-memory sync counter for instant inter-service pinging
let syncTimestamp = Date.now();

export async function GET() {
  return NextResponse.json({ syncTimestamp }, { headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    syncTimestamp = Date.now();
    return NextResponse.json({ ok: true, syncTimestamp, event: payload?.event || 'PING' }, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({ ok: true, syncTimestamp: Date.now() }, { headers: CORS_HEADERS });
  }
}
