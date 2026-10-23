import { NextResponse } from 'next/server';
import { runAiTriage, TriageInputResource } from '@/lib/engines/triage';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const notes: string = body?.notes || body?.text || '';
    const resources: TriageInputResource[] = body?.resources || [];
    const headcount: number = Number(body?.headcount) || 25;
    const zoneName: string = body?.zoneName || 'Sector 4 - Riverside Colony';

    const result = await runAiTriage({ notes, resources, headcount, zoneName });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
