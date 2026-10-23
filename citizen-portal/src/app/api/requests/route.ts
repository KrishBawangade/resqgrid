import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { runAiTriage, TriageInputResource } from '@/lib/engines/triage';
import { computePriorityScore } from '@/lib/engines/prioritization';
import { SIMULATED_ZONES } from '@/lib/data/initialScenario';
import {
  ResourceType,
  UrgencyLevel,
  VulnerabilityFactors,
  ReliefRequest,
} from '@/lib/types';


// Map database row to frontend ReliefRequest type
export function formatDbRequest(row: {
  id: string;
  timestamp: Date | string;
  requesterName: string;
  contactNumber: string;
  resourceType: string;
  requestedQty: number;
  allocatedQty: number;
  unfulfilledQty: number;
  requestedResources: unknown;
  locationZoneName: string;
  locationLat: number;
  locationLng: number;
  locationAccessibility: string;
  peopleAffected: number;
  vulnerability: unknown;
  urgencyLevel: string;
  scoreBreakdown: unknown;
  priorityScore: number;
  verificationStatus: string;
  requestStatus: string;
  allocatedDepotId: string | null;
  notes: string | null;
  waitingMinutes: number;
  aiTriageInsight: string | null;
  aiConfidence: number | null;
  aiTriageDetails: unknown;
  rejectionReason: string | null;
}): ReliefRequest {
  return {
    id: row.id,
    timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : String(row.timestamp),
    requesterName: row.requesterName,
    contactNumber: row.contactNumber,
    resourceType: row.resourceType as ResourceType,
    requestedQty: row.requestedQty,
    allocatedQty: row.allocatedQty,
    unfulfilledQty: row.unfulfilledQty,
    requestedResources: (row.requestedResources as Array<{
      resourceType: ResourceType;
      requestedQty: number;
      allocatedQty: number;
      unfulfilledQty: number;
    }>) || [],
    location: {
      zoneName: row.locationZoneName,
      lat: row.locationLat,
      lng: row.locationLng,
      isSimulated: true,
      accessibility: row.locationAccessibility as ReliefRequest['location']['accessibility'],
    },
    peopleAffected: row.peopleAffected,
    vulnerability: (row.vulnerability as VulnerabilityFactors) || {
      hasChildren: false,
      hasElderly: false,
      hasInjured: false,
      isClinic: false,
    },
    urgencyLevel: row.urgencyLevel as UrgencyLevel,
    scoreBreakdown: row.scoreBreakdown as ReliefRequest['scoreBreakdown'],
    priorityScore: row.priorityScore,
    verificationStatus: row.verificationStatus as ReliefRequest['verificationStatus'],
    requestStatus: row.requestStatus as ReliefRequest['requestStatus'],
    allocatedDepotId: row.allocatedDepotId,
    notes: row.notes || undefined,
    waitingMinutes: row.waitingMinutes,
    aiTriageInsight: row.aiTriageInsight || undefined,
    aiConfidence: row.aiConfidence || undefined,
    aiTriageDetails: row.aiTriageDetails as ReliefRequest['aiTriageDetails'],
    rejectionReason: row.rejectionReason || undefined,
  };
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

// GET /api/requests - Fetch all requests from Neon PostgreSQL
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);
    const zoneName = searchParams.get('zone');

    const where: Record<string, unknown> = {};
    if (zoneName) {
      where.locationZoneName = zoneName;
    }

    const rows = await db.reliefRequest.findMany({
      where,
      orderBy: { priorityScore: 'desc' },
      take: limit,
    });

    return NextResponse.json(rows.map(formatDbRequest), { headers: CORS_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database fetch error';
    console.error('Error fetching relief requests from Neon:', err);
    return NextResponse.json({ error: message }, { status: 500, headers: CORS_HEADERS });
  }
}

// POST /api/requests - AI Triage + Save to Neon PostgreSQL
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const requesterName: string = body.requesterName?.trim() || 'Anonymous Resident';
    const contactNumber: string = body.contactNumber?.trim() || 'Unspecified Contact';
    const zoneName: string = body.zoneName || 'Sector 4 - Riverside Colony';
    const customCoords: { lat: number; lng: number } | undefined = body.customCoords;
    const headcount: number = Math.max(1, Number(body.headcount) || 1);
    const resources: TriageInputResource[] = body.resources || [];
    const notes: string = body.notes?.trim() || '';

    // 1. Sector Context & Ground Truth
    const zoneContext = SIMULATED_ZONES.find((z) => z.zoneName === zoneName) || SIMULATED_ZONES[0];
    const lat = customCoords?.lat ?? zoneContext.lat;
    const lng = customCoords?.lng ?? zoneContext.lng;

    // 2. Step 1: Give to AI Triage (Gemini AI with Local NLP fallback)
    const triageData = await runAiTriage({
      notes,
      resources,
      headcount,
      zoneName,
    });

    const primaryRes: ResourceType = triageData.primaryResourceType || resources[0]?.resourceType || 'drinking_water';
    const urgency: UrgencyLevel = triageData.urgencyLevel || 'moderate';
    const vulnFactors: VulnerabilityFactors = triageData.vulnerability || {
      hasChildren: false,
      hasElderly: false,
      hasInjured: false,
      isClinic: false,
    };

    // 3. Step 2: Calculate Deterministic 55/20/15/10 Priority Score
    const scoreBreakdown = computePriorityScore(
      primaryRes,
      urgency,
      vulnFactors,
      headcount,
      0, // waitingMinutes initially 0
      {
        criticalityScore: triageData.criticalityScore,
        vulnerabilityScore: triageData.vulnerabilityScore,
      }
    );

    // 4. Generate Unique Request ID (REQ-XXXX)
    let newId = `REQ-${Math.floor(1000 + Math.random() * 9000)}`;
    const existing = await db.reliefRequest.findUnique({ where: { id: newId } });
    if (existing) {
      newId = `REQ-${Math.floor(10000 + Math.random() * 90000)}`;
    }

    // Format requestedResources array
    const requestedResourcesList = resources.map((r) => ({
      resourceType: r.resourceType,
      requestedQty: r.requestedQty,
      allocatedQty: 0,
      unfulfilledQty: r.requestedQty,
    }));

    const primaryResourceObj = requestedResourcesList.find((r) => r.resourceType === primaryRes) || requestedResourcesList[0];
    const primaryQty = primaryResourceObj?.requestedQty || 100;

    // 5. Step 3: Persist into Neon Serverless PostgreSQL Database
    const savedRow = await db.reliefRequest.create({
      data: {
        id: newId,
        timestamp: new Date(),
        requesterName,
        contactNumber,
        resourceType: primaryRes,
        requestedQty: primaryQty,
        allocatedQty: 0,
        unfulfilledQty: primaryQty,
        requestedResources: requestedResourcesList,
        locationZoneName: zoneContext.zoneName,
        locationLat: lat,
        locationLng: lng,
        locationAccessibility: zoneContext.accessibility,
        peopleAffected: headcount,
        vulnerability: vulnFactors as unknown as object,
        urgencyLevel: urgency,
        scoreBreakdown: scoreBreakdown as unknown as object,
        priorityScore: scoreBreakdown.totalScore,
        verificationStatus: 'pending',
        requestStatus: 'submitted',
        notes: notes || null,
        waitingMinutes: 0,
        aiTriageInsight: triageData.aiTriageInsight || null,
        aiConfidence: triageData.aiConfidence || null,
        aiTriageDetails: {
          criticalityScore: triageData.criticalityScore,
          criticalityReason: triageData.criticalityReason,
          vulnerabilityScore: triageData.vulnerabilityScore,
          vulnerabilityReason: triageData.vulnerabilityReason,
          recommendedDispatch: triageData.recommendedDispatch,
          engineUsed: triageData.engineUsed,
        },
      },
    });

    // 6. Log to Immutable Audit Ledger in Neon
    try {
      await db.auditLog.create({
        data: {
          action: 'INTAKE_SUBMISSION',
          actor: `${requesterName} (Citizen Intake)`,
          details: `Emergency request ${newId} submitted in ${zoneContext.zoneName} for ${headcount} individuals. Primary: ${primaryRes}. AI Triage: ${urgency.toUpperCase()} (Priority Score: ${scoreBreakdown.totalScore.toFixed(1)}/100, Engine: ${triageData.engineUsed}).`,
          requestId: newId,
        },
      });
    } catch (auditErr) {
      console.warn('AuditLog insertion warning (non-fatal):', auditErr);
    }

    console.log(`[ResQGrid DB] Successfully persisted ${newId} to Neon PostgreSQL with Priority Score ${scoreBreakdown.totalScore}`);

    const result = formatDbRequest(savedRow);

    // Stream event directly to Coordinator Portal Realtime SSE channel
    try {
      fetch('http://localhost:3000/api/requests/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'NEW_REQUEST', data: result }),
      }).catch(() => {});
    } catch (_) {}

    return NextResponse.json(result, { status: 201, headers: CORS_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database insertion error';
    console.error('[ResQGrid API] Submission error:', err);
    return NextResponse.json({ error: message }, { status: 500, headers: CORS_HEADERS });
  }
}

// PATCH /api/requests - Update request status / allocation in Neon
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { 
      id, 
      verificationStatus, 
      requestStatus, 
      allocatedDepotId, 
      allocatedQty, 
      unfulfilledQty,
      requestedResources,
      priorityScore,
      rejectionReason,
      notes,
      waitingMinutes,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400, headers: CORS_HEADERS });
    }

    const updateData: Record<string, unknown> = {};
    if (verificationStatus !== undefined) updateData.verificationStatus = verificationStatus;
    if (requestStatus !== undefined) updateData.requestStatus = requestStatus;
    if (allocatedDepotId !== undefined) updateData.allocatedDepotId = allocatedDepotId;
    if (allocatedQty !== undefined) updateData.allocatedQty = allocatedQty;
    if (unfulfilledQty !== undefined) updateData.unfulfilledQty = unfulfilledQty;
    if (requestedResources !== undefined) updateData.requestedResources = requestedResources;
    if (priorityScore !== undefined) updateData.priorityScore = priorityScore;
    if (rejectionReason !== undefined) updateData.rejectionReason = rejectionReason;
    if (notes !== undefined) updateData.notes = notes;
    if (waitingMinutes !== undefined) updateData.waitingMinutes = waitingMinutes;

    const updated = await db.reliefRequest.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(formatDbRequest(updated), { headers: CORS_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 500, headers: CORS_HEADERS });
  }
}
