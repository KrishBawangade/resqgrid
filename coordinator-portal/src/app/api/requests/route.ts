import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { INITIAL_REQUESTS } from '@/lib/data/initialScenario';
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

// GET /api/requests - Fetch all requests from Neon PostgreSQL
export async function GET() {
  try {
    const rows = await db.reliefRequest.findMany({
      orderBy: { priorityScore: 'desc' },
    });

    if (rows.length === 0) {
      // If DB has not been seeded yet, return initial scenario requests
      return NextResponse.json(INITIAL_REQUESTS);
    }

    return NextResponse.json(rows.map(formatDbRequest));
  } catch (err: unknown) {
    console.error('Error fetching requests from Neon:', err);
    // Graceful fallback to initial scenario
    return NextResponse.json(INITIAL_REQUESTS);
  }
}

// PATCH /api/requests - Update request status / allocation in Neon
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, verificationStatus, requestStatus, allocatedDepotId, allocatedQty, unfulfilledQty } = body;

    if (!id) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (verificationStatus) updateData.verificationStatus = verificationStatus;
    if (requestStatus) updateData.requestStatus = requestStatus;
    if (allocatedDepotId !== undefined) updateData.allocatedDepotId = allocatedDepotId;
    if (allocatedQty !== undefined) updateData.allocatedQty = allocatedQty;
    if (unfulfilledQty !== undefined) updateData.unfulfilledQty = unfulfilledQty;

    const updated = await db.reliefRequest.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(formatDbRequest(updated));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
