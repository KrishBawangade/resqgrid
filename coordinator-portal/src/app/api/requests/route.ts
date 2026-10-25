import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { INITIAL_REQUESTS } from '@/lib/data/initialScenario';
import {
  ResourceType,
  UrgencyLevel,
  VulnerabilityFactors,
  ReliefRequest,
} from '@/lib/types';
import { broadcastRealtimeEvent } from '@/lib/events';


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
  let parsedRequestedResources: Array<{
    resourceType: ResourceType;
    requestedQty: number;
    allocatedQty: number;
    unfulfilledQty: number;
  }> = [];

  if (Array.isArray(row.requestedResources)) {
    parsedRequestedResources = row.requestedResources as Array<{
      resourceType: ResourceType;
      requestedQty: number;
      allocatedQty: number;
      unfulfilledQty: number;
    }>;
  } else if (typeof row.requestedResources === 'string') {
    try {
      const p = JSON.parse(row.requestedResources);
      if (Array.isArray(p)) parsedRequestedResources = p;
    } catch (_) {}
  }

  if (parsedRequestedResources.length === 0 && row.resourceType) {
    parsedRequestedResources = [{
      resourceType: row.resourceType as ResourceType,
      requestedQty: row.requestedQty,
      allocatedQty: row.allocatedQty,
      unfulfilledQty: row.unfulfilledQty,
    }];
  }

  // Ensure items in requestedResources reflect fulfilled lifecycle status
  if (row.requestStatus === 'delivered' || row.requestStatus === 'fully_allocated' || (row.unfulfilledQty === 0 && row.allocatedQty > 0)) {
    parsedRequestedResources = parsedRequestedResources.map((item) => ({
      ...item,
      allocatedQty: item.requestedQty,
      unfulfilledQty: 0,
    }));
  } else if (parsedRequestedResources.length === 1 && (row.allocatedQty > 0 || row.unfulfilledQty !== row.requestedQty)) {
    parsedRequestedResources[0].allocatedQty = row.allocatedQty;
    parsedRequestedResources[0].unfulfilledQty = row.unfulfilledQty;
  }

  const totalReq = parsedRequestedResources.reduce((s, r) => s + (Number(r.requestedQty) || 0), 0);
  const totalAlloc = parsedRequestedResources.reduce((s, r) => s + (Number(r.allocatedQty) || 0), 0);
  const totalUnful = parsedRequestedResources.reduce((s, r) => s + (Number(r.unfulfilledQty) || 0), 0);

  const finalRequestedQty = parsedRequestedResources.length > 1 && totalReq > 0 ? totalReq : row.requestedQty;
  const finalAllocatedQty = parsedRequestedResources.length > 1 ? totalAlloc : row.allocatedQty;
  const finalUnfulfilledQty = parsedRequestedResources.length > 1 && totalReq > 0 ? totalUnful : row.unfulfilledQty;

  return {
    id: row.id,
    timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : String(row.timestamp),
    requesterName: row.requesterName,
    contactNumber: row.contactNumber,
    resourceType: row.resourceType as ResourceType,
    requestedQty: finalRequestedQty,
    allocatedQty: finalAllocatedQty,
    unfulfilledQty: finalUnfulfilledQty,
    requestedResources: parsedRequestedResources,
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
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

// Ensure INITIAL_REQUESTS are seeded into Neon PostgreSQL if missing
export async function ensureInitialRequestsSeeded() {
  for (const req of INITIAL_REQUESTS) {
    const existing = await db.reliefRequest.findUnique({ where: { id: req.id } });
    if (!existing) {
      await db.reliefRequest.create({
        data: {
          id: req.id,
          timestamp: new Date(req.timestamp),
          requesterName: req.requesterName,
          contactNumber: req.contactNumber,
          resourceType: req.resourceType,
          requestedQty: req.requestedQty,
          allocatedQty: req.allocatedQty,
          unfulfilledQty: req.unfulfilledQty,
          requestedResources: (req.requestedResources && req.requestedResources.length > 0)
            ? (req.requestedResources as object)
            : [{
                resourceType: req.resourceType,
                requestedQty: req.requestedQty,
                allocatedQty: req.allocatedQty,
                unfulfilledQty: req.unfulfilledQty,
              }],
          locationZoneName: req.location.zoneName,
          locationLat: req.location.lat,
          locationLng: req.location.lng,
          locationAccessibility: req.location.accessibility,
          peopleAffected: req.peopleAffected,
          vulnerability: req.vulnerability as unknown as object,
          urgencyLevel: req.urgencyLevel,
          scoreBreakdown: req.scoreBreakdown as unknown as object,
          priorityScore: req.priorityScore,
          verificationStatus: req.verificationStatus,
          requestStatus: req.requestStatus,
          allocatedDepotId: req.allocatedDepotId,
          notes: req.notes || null,
          waitingMinutes: req.waitingMinutes,
          aiTriageInsight: req.aiTriageInsight || null,
          aiConfidence: req.aiConfidence || null,
        },
      });
    }
  }
}

// GET /api/requests - Fetch all requests from Neon PostgreSQL
export async function GET() {
  try {
    let rows = await db.reliefRequest.findMany({
      orderBy: { priorityScore: 'desc' },
    });

    if (rows.length === 0) {
      await ensureInitialRequestsSeeded();
      rows = await db.reliefRequest.findMany({
        orderBy: { priorityScore: 'desc' },
      });
    }

    return NextResponse.json(rows.map(formatDbRequest), { headers: CORS_HEADERS });
  } catch (err: unknown) {
    console.error('Error fetching requests from Neon:', err);
    // Graceful fallback to initial scenario
    return NextResponse.json(INITIAL_REQUESTS, { headers: CORS_HEADERS });
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

    const existing = await db.reliefRequest.findUnique({ where: { id } });
    let updated;

    if (!existing) {
      const initial = INITIAL_REQUESTS.find((r) => r.id === id);
      if (initial) {
        updated = await db.reliefRequest.create({
          data: {
            id: initial.id,
            timestamp: new Date(initial.timestamp),
            requesterName: initial.requesterName,
            contactNumber: initial.contactNumber,
            resourceType: (body.resourceType as string) || initial.resourceType,
            requestedQty: initial.requestedQty,
            allocatedQty: updateData.allocatedQty !== undefined ? (updateData.allocatedQty as number) : initial.allocatedQty,
            unfulfilledQty: updateData.unfulfilledQty !== undefined ? (updateData.unfulfilledQty as number) : initial.unfulfilledQty,
            requestedResources: updateData.requestedResources !== undefined ? (updateData.requestedResources as object) : (initial.requestedResources || [{
              resourceType: initial.resourceType,
              requestedQty: initial.requestedQty,
              allocatedQty: initial.allocatedQty,
              unfulfilledQty: initial.unfulfilledQty,
            }]),
            locationZoneName: initial.location.zoneName,
            locationLat: initial.location.lat,
            locationLng: initial.location.lng,
            locationAccessibility: initial.location.accessibility,
            peopleAffected: initial.peopleAffected,
            vulnerability: initial.vulnerability as unknown as object,
            urgencyLevel: initial.urgencyLevel,
            scoreBreakdown: initial.scoreBreakdown as unknown as object,
            priorityScore: updateData.priorityScore !== undefined ? (updateData.priorityScore as number) : initial.priorityScore,
            verificationStatus: updateData.verificationStatus !== undefined ? (updateData.verificationStatus as string) : initial.verificationStatus,
            requestStatus: updateData.requestStatus !== undefined ? (updateData.requestStatus as string) : initial.requestStatus,
            allocatedDepotId: updateData.allocatedDepotId !== undefined ? (updateData.allocatedDepotId as string | null) : initial.allocatedDepotId,
            notes: updateData.notes !== undefined ? (updateData.notes as string | null) : initial.notes,
            waitingMinutes: updateData.waitingMinutes !== undefined ? (updateData.waitingMinutes as number) : initial.waitingMinutes,
            aiTriageInsight: initial.aiTriageInsight,
            aiConfidence: initial.aiConfidence,
            rejectionReason: updateData.rejectionReason !== undefined ? (updateData.rejectionReason as string | null) : undefined,
          },
        });
      } else {
        return NextResponse.json({ error: `Request ${id} not found in database` }, { status: 404, headers: CORS_HEADERS });
      }
    } else {
      updated = await db.reliefRequest.update({
        where: { id },
        data: updateData,
      });
    }

    // 1. Synchronize depot stock if allocation delta is provided
    const allocationsToProcess: Array<{ depotId: string; resourceType: string; quantity: number }> = [];
    if (Array.isArray(body.depotAllocations)) {
      allocationsToProcess.push(...body.depotAllocations);
    } else if (body.depotAllocation) {
      allocationsToProcess.push(body.depotAllocation);
    }

    if (allocationsToProcess.length > 0) {
      try {
        for (const alloc of allocationsToProcess) {
          const { depotId, resourceType, quantity } = alloc;
          if (depotId && resourceType && typeof quantity === 'number' && quantity > 0) {
            const currentStock = await db.depotStock.findUnique({
              where: {
                depotId_resourceType: { depotId, resourceType },
              },
            });

            const currentAvail = currentStock ? currentStock.availableStock : 100;
            const currentAlloc = currentStock ? currentStock.allocatedStock : 0;
            const currentTotal = currentStock ? currentStock.totalStock : 250;

            const newAvailable = Math.max(0, currentAvail - quantity);
            const newAllocated = currentAlloc + quantity;

            await db.depotStock.upsert({
              where: {
                depotId_resourceType: { depotId, resourceType },
              },
              update: {
                availableStock: newAvailable,
                allocatedStock: newAllocated,
              },
              create: {
                depotId,
                resourceType,
                availableStock: newAvailable,
                allocatedStock: newAllocated,
                totalStock: currentTotal,
                lowStockThreshold: 50,
              },
            });

            await db.auditLog.create({
              data: {
                action: 'ALLOCATION',
                actor: 'Stock Allocation Engine',
                details: `Allocated ${quantity} units of ${resourceType.replace('_', ' ')} from ${depotId} for request ${updated.id}. Reserved stock increased to ${newAllocated}.`,
                requestId: updated.id,
              },
            });
          }
        }

        const { getFormattedDepots } = await import('@/app/api/depots/route');
        const updatedDepots = await getFormattedDepots();
        broadcastRealtimeEvent('DEPOTS_UPDATED', updatedDepots);
      } catch (depotSyncErr) {
        console.error('Error synchronizing depot stock in request PATCH:', depotSyncErr);
      }
    }

    // 2. When request is confirmed delivered, auto-clear and deduct reserved stock from the staging depot
    if (requestStatus === 'delivered') {
      try {
        const depotId = (body.allocatedDepotId as string) || updated.allocatedDepotId;
        const requestedResources = Array.isArray(updated.requestedResources)
          ? (updated.requestedResources as Array<{ resourceType: string; allocatedQty: number }>)
          : [{ resourceType: (body.resourceType as string) || updated.resourceType, allocatedQty: typeof body.allocatedQty === 'number' ? body.allocatedQty : updated.allocatedQty }];

        if (depotId && requestedResources.length > 0) {
          for (const item of requestedResources) {
            const qty = item.allocatedQty || 0;
            const resType = item.resourceType;
            if (qty > 0 && resType) {
              const currentStock = await db.depotStock.findUnique({
                where: {
                  depotId_resourceType: { depotId, resourceType: resType },
                },
              });

              if (currentStock) {
                const newAllocated = Math.max(0, currentStock.allocatedStock - qty);
                await db.depotStock.update({
                  where: {
                    depotId_resourceType: { depotId, resourceType: resType },
                  },
                  data: {
                    allocatedStock: newAllocated,
                  },
                });
              }
            }
          }

          // Immutable audit trail for completed field delivery and released reservation
          const auditEntry = await db.auditLog.create({
            data: {
              action: 'DELIVERY_CONFIRMED',
              actor: 'Field Operations Crew',
              details: `Delivery confirmed for demand ${updated.id}. Reserved warehouse stock cleared at ${depotId}. Demand 100% fulfilled.`,
              requestId: updated.id,
            },
          });

          const { getFormattedDepots } = await import('@/app/api/depots/route');
          const updatedDepots = await getFormattedDepots();
          broadcastRealtimeEvent('DEPOTS_UPDATED', updatedDepots);
          broadcastRealtimeEvent('AUDIT_LOG_ADDED', {
            id: auditEntry.id,
            timestamp: auditEntry.timestamp.toLocaleTimeString() + ' UTC',
            category: 'ALLOCATION',
            action: auditEntry.action,
            actor: auditEntry.actor,
            details: auditEntry.details,
            delta: `Demand ${updated.id} Fulfilled`,
          });
        }
      } catch (deliveryErr) {
        console.error('Error synchronizing delivery in Neon:', deliveryErr);
      }
    }

    const formatted = formatDbRequest(updated);
    broadcastRealtimeEvent('REQUEST_UPDATED', formatted);

    return NextResponse.json(formatted, { headers: CORS_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 500, headers: CORS_HEADERS });
  }
}

// DELETE /api/requests - Delete specific or unseeded requests from Neon
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      await db.reliefRequest.delete({ where: { id } }).catch(() => {});
      broadcastRealtimeEvent('REQUEST_DELETED', { id });
      return NextResponse.json({ ok: true, deleted: id }, { headers: CORS_HEADERS });
    }

    // If no id param is passed, delete all unseeded requests
    const seededIds = INITIAL_REQUESTS.map((r) => r.id);
    const result = await db.reliefRequest.deleteMany({
      where: {
        id: { notIn: seededIds },
      },
    });

    const remainingRows = await db.reliefRequest.findMany({
      orderBy: { priorityScore: 'desc' },
    });
    const formatted = remainingRows.map(formatDbRequest);
    broadcastRealtimeEvent('REQUESTS_RESET', formatted);

    return NextResponse.json(
      { ok: true, deletedCount: result.count, remaining: formatted },
      { headers: CORS_HEADERS }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    return NextResponse.json({ error: message }, { status: 500, headers: CORS_HEADERS });
  }
}
