import { NextRequest, NextResponse } from 'next/server';
import { realtimeEmitter, broadcastRealtimeEvent, RealtimeEventPayload } from '@/lib/events';

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

// POST /api/requests/stream - External or cross-app trigger to publish an event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const type = body.type || 'NEW_REQUEST';
    const data = body.data;

    broadcastRealtimeEvent(type, data);

    return NextResponse.json({ ok: true, broadcasted: type }, { headers: CORS_HEADERS });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Broadcast failed';
    return NextResponse.json({ error: msg }, { status: 500, headers: CORS_HEADERS });
  }
}

// GET /api/requests/stream - Persistent Server-Sent Events (SSE) Stream
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Initial Connection confirmation
      const initPayload = JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() });
      controller.enqueue(encoder.encode(`data: ${initPayload}\n\n`));

      // 2. Event Listener Callback
      const onEvent = (payload: RealtimeEventPayload) => {
        try {
          const sseString = `data: ${JSON.stringify(payload)}\n\n`;
          controller.enqueue(encoder.encode(sseString));
        } catch (err) {
          console.warn('SSE enqueue error:', err);
        }
      };

      realtimeEmitter.on('dispatch-event', onEvent);

      // 3. Heartbeat keepalive every 15s to prevent intermediate proxy timeout
      const keepaliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          clearInterval(keepaliveInterval);
        }
      }, 15000);

      // 4. Handle client disconnection
      request.signal.addEventListener('abort', () => {
        clearInterval(keepaliveInterval);
        realtimeEmitter.off('dispatch-event', onEvent);
        try {
          controller.close();
        } catch {
          // Stream already closed
        }
      });
    },
    cancel() {
      // Clean up when stream is cancelled
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
