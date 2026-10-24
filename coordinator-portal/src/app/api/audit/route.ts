import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { INITIAL_AUDIT_LOGS } from '@/lib/data/initialScenario';
import { AuditLogEntry } from '@/lib/types';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function formatDbAuditLog(row: {
  id: string;
  timestamp: Date;
  action: string;
  actor: string;
  details: string;
  requestId: string | null;
}): AuditLogEntry {
  let category: AuditLogEntry['category'] = 'ALLOCATION';
  const a = row.action.toUpperCase();
  if (a.includes('OVERRIDE')) category = 'OVERRIDE';
  else if (a.includes('VERIF')) category = 'VERIFICATION';
  else if (a.includes('REPLENISH') || a.includes('DELIVERY')) category = 'REPLENISHMENT';

  return {
    id: row.id,
    timestamp: row.timestamp.toLocaleTimeString() + ' UTC',
    category,
    action: row.action,
    actor: row.actor,
    details: row.details,
    delta: row.requestId ? `Ref: ${row.requestId}` : undefined,
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

// GET /api/audit - Fetch recent audit entries
export async function GET() {
  try {
    const rows = await db.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    if (rows.length === 0) {
      return NextResponse.json(INITIAL_AUDIT_LOGS, { headers: CORS_HEADERS });
    }

    return NextResponse.json(rows.map(formatDbAuditLog), { headers: CORS_HEADERS });
  } catch (err: unknown) {
    console.error('Error fetching audit logs from Neon DB:', err);
    return NextResponse.json(INITIAL_AUDIT_LOGS, { headers: CORS_HEADERS });
  }
}
